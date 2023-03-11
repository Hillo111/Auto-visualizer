from http.server import BaseHTTPRequestHandler, HTTPServer
import time
import os
import threading
import glob
import json
from compiler import make_auto

def make_autos(file):
    d = {'blue': make_auto(file), 'red': make_auto(file, False)}
    with open(f'trajectories/{file.split("/")[-1]}.json', 'w') as f:
        json.dump(d, f)


AUTOS_PATH = 'auto/autos/'
POINTS_PATH = 'auto/points/'

ROBORIO = 'lvuser@10.68.1.2'
CYCLE = 0.2 # seconds

hostName = "localhost"
serverPort = 6801

ending_to_content_type = {
    '.png': "image/png",
    '.jpeg': "image/jpeg",
    '.jpg': "image/jpg",
    ".csv": "text/csv",
    '.js': 'text/javascript',
    '.css': 'text/css',
}
default_content_type = 'text/plain'

file_dirs = ['scripts/', 'static/', 'css/', 'auto/autos/', 'trajectories/', 'auto/points/']

path_to_page = {
    '': 'index.html',
    'logging': 'logging.html',
    'trajectory-visualization': 'trajectory-visualizer.html'
}
default_page = None

values = {
    'auto-options': (lambda : list(g[g.rfind('/') + 1:] for g in glob.glob('auto/autos/*')))
}

class MyServer(BaseHTTPRequestHandler):
    @staticmethod
    def get_file(filename: str):
        if not os.path.isfile(filename):
            return None, None

        content_type = default_content_type
        for e in ending_to_content_type:
            if filename.endswith(e):
                content_type = ending_to_content_type[e]
                break
        
        with open(filename, 'rb') as f:
            return f.read(), content_type

    def do_GET(self):
        p = self.path.split('/')[1:]
        print(p[-1])

        for dir in file_dirs:
            content, content_type = MyServer.get_file(dir + p[-1])
            if content_type is not None:
                self.send_response(200)
                self.send_header('Content-type', content_type)
                self.end_headers()
                self.wfile.write(content)
                return
        
        page = path_to_page.setdefault('/'.join(p), None)

        if page is not None:
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()

            with open(page, 'r') as f:
                self.wfile.write(bytes(f.read(), 'utf-8'))
            return

        if p[0] == 'vals':
            val = values.setdefault(p[-1], None)
            if val is not None:
                self.send_response(200)
                if callable(val):
                    val = val()
                self.send_header('Content-type', 'text/json')
                self.end_headers()
                self.wfile.write(bytes(json.dumps(val), 'utf-8'))
                return

        self.send_response_only(404)
        self.end_headers()

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length'))
        post_body = self.rfile.read(content_len).decode('utf-8')
        '''
        post_json = {}
        for l in post_body.split('&'):
            print(l, flush=True)
            k, v = l.split('=')
            post_json[k] = v
        '''
        post_json = json.loads(post_body)

        if sum((k not in post_json) for k in ('cmd', 'name', 'content')) != 0:
            self.send_response(400)
            self.end_headers()
            return
        
        self.send_response(200)
        self.end_headers()
        
        if post_json['cmd'] == 'update-auto':
            fp = f'auto/autos/{post_json["name"]}'
            with open(fp, 'w') as f:
                f.write(post_json['content'])
            # os.system(f'scp {fp} {ROBORIO}:~/auto/autos/.')
            make_autos(fp)
            with open(f'trajectories/{post_json["name"]}.json', 'rb') as f:
                self.wfile.write(f.read())
        if post_json['cmd'] == 'update-points':
            with open(f'auto/points/{post_json["name"]}', 'w') as f:
                f.write(post_json['content'])
            # os.system(f'scp auto/points/{post_json["name"]} {ROBORIO}:~/auto/points/.')

def pull_data():
    while True:
        os.system(f'scp {ROBORIO}:~/auto/autos/* auto/autos/.')
        os.system(f'scp {ROBORIO}:~/auto/points/* auto/points/.')

        time.sleep(CYCLE)

auto_files = {}

def compileAutos():
    global auto_files
    while True:
        for fp in glob.glob('auto/autos/*'):
            a = fp.split('/')[-1]
            with open(fp, 'r') as f:
                content = f.read()
            if a not in auto_files:
                auto_files[a] = ''
            if auto_files[a] != content:
                auto_files[a] = content
                make_autos(fp)
        time.sleep(CYCLE)


if __name__ == "__main__":
    for file in glob.glob('auto/autos/*.csv'):
        make_autos(file)

    threading.Thread(target=compileAutos, daemon=True).start()

    webServer = HTTPServer((hostName, serverPort), MyServer)
    print("Server started http://%s:%s" % (hostName, serverPort))

    try:
        webServer.serve_forever()
    except KeyboardInterrupt:
        pass

    webServer.server_close()
    print("Server stopped.")