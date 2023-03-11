import time

import sys
import os
sys.path.insert(1, os.path.join(sys.path[0], '..'))

import tkinter as tk
from tkinter.scrolledtext import ScrolledText
import compiler
import matplotlib.pyplot as plt
from math import *

fig, ax = None, None

def display_auto():
    global fig, ax
    with open('temp.csv', 'w') as f:
        f.write(code.get(1.0, tk.END)[:-1])
    print(int(traj.get()))
    d = compiler.make_auto('temp.csv') 
    d = d[int(traj.get())]
    d = d['states']

    fig, ax = plt.subplots()

    with open('auto/points/blue_points.csv', 'r') as f:
        for line in f.readlines():
            l = line.split(',')
            if len(l) < 3:
                continue
            x, y = float(l[1]), float(l[2])
            ax.plot(x, y, 'bs')
            ax.text(x + 0.1, y + 0.1, l[0])

    for state in d[::1] + [d[-1]]:
        ang = state['angle'] / 180 * pi
        ax.arrow(state['x'], state['y'], cos(ang) * 0.2, sin(ang) * 0.2, color=(1.,0.,0.))
        c = state['t'] / d[-1]['t']
        ax.plot(state['x'], state['y'], marker=(3, 0, (ang - pi / 2) / pi * 180), markersize=10, color=(0, c, 0))

    img = plt.imread("static/april_field.png")
    ax.imshow(img, extent=[0, 16.3, 0, 8.02])
    fig.set_figwidth(16)
    fig.set_figheight(8)
    plt.show()

root = tk.Tk()

tk.Label(text="Put auto here:").pack()

code = ScrolledText(root)
code.pack()

tk.Label(text='Trajectory index to display:').pack()
traj = tk.Entry(root)
traj.pack()

submit = tk.Button(root, text="Submit", command=display_auto)
submit.pack()

root.mainloop()