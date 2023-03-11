import wpimath.trajectory as trajectory
from wpimath.geometry import Pose2d
import json
from math import pi

AUTO_MAX_SPEED = 10.0
AUTO_MAX_ACCEL = 0.75
TRANS_VELOCITY = 4.952
points = {}

def load_points(blue_side: bool = True):
    with open(f'auto/points/{"blue" if blue_side else "red"}_points.csv', 'r') as f:
        lines = f.read().split('\n')
    for line in lines:
        l = line.split(',')
        if len(l) < 3 or line.startswith('//'):
            continue
        points[l[0]] = [float(l[1]), float(l[2])]

def make_auto(filename: str, blue_side: bool = True):
    load_points(blue_side)

    with open(filename, 'r') as f:
        lines = f.read().split('\n')

    old_lines = list(l for l in lines)
    line_indexes = []
    for i, line in enumerate(old_lines):
        l = line.split(',')
        if len(l) == 0 or line.startswith('//'):
            lines.remove(line)
            continue
        line_indexes.append(i)

    actions = []
    traj_pos = []
    traj_reversed = False
    last_angle = None
    for i, line in enumerate(lines):
        l = line.split(',')
        if len(l) == 0 or line.startswith('//'):
            continue

        cmd = l[0]

        if cmd == 'trajectory':
            if len(l) < 4:
                raise SyntaxError(f"On line {i + 1}: Trajectory command expected 4 parameters, received {len(l)}")
            pn1, pn2, angle = l[1], l[2], float(l[3])
            if not blue_side:
                angle = -angle
            if pn1 not in points:
                raise KeyError(f"On line {i + 1}: Point {pn1} does not exist")
            if pn2 not in points:
                raise KeyError(f"On line {i + 1}: Point {pn2} does not exist")
            p1 = Pose2d(*points[pn1], angle / 180 * pi)
            p2 = Pose2d(*points[pn2], angle / 180 * pi)
            reversed = False
            if len(l) >= 5:
                reversed = l[4] in ("reversed", 'reverse')

            if len(traj_pos) == 0:
                if last_angle is not None:
                    p1 = Pose2d(p1.x, p1.y, last_angle)
                traj_pos = [p1, p2]
                traj_reversed = reversed
                last_angle = p2.rotation()
            elif reversed != traj_reversed:
                actions.append([line_indexes[i], 'trajectory', traj_pos, traj_reversed])
                if last_angle is not None:
                    p1 = Pose2d(p1.x, p1.y, last_angle)
                traj_pos = [p1, p2]
                traj_reversed = reversed
                last_angle = p2.rotation()
            else:
                traj_pos.append(p2)
                last_angle = p2.rotation()
        else:
            if len(traj_pos) > 0:
                actions.append([line_indexes[i - 1], 'trajectory', traj_pos, traj_reversed])
                traj_pos = []

            if cmd == 'split':
                if len(l) >= 3 and l[2] == 'multiplier':
                    vel = float(l[1]) * TRANS_VELOCITY
                elif len(l) >= 2:
                    vel = float(l[1])
                else:
                    vel = TRANS_VELOCITY
                actions.append([line_indexes[i], 'split', vel])
            elif cmd in ('accel', 'acceleration'):
                a = AUTO_MAX_ACCEL
                if len(l) == 2:
                    a = float(l[1])
                elif len(l) == 3 and l[2] == 'multiplier':
                    a = AUTO_MAX_ACCEL * float(l[1])
                actions.append([line_indexes[i], 'acceleration', a])
            elif cmd == 'reset_odom':
                if len(l) < 3:
                    raise SyntaxError(f"On line {i + 1}: Trajectory command expected 3 parameters, received {len(l)}")
                pn, angle = l[1], float(l[2])
                if not blue_side:
                    angle = -angle
                if pn not in points:
                    raise KeyError(f"On line {i + 1}: Point {pn} does not exist")
                p = Pose2d(*points[pn], angle / 180 * pi)
                last_angle = p.rotation()
                actions.append([line_indexes[i], 'reset_odom', p])
            else:
                actions.append([line_indexes[i], 'other'])
    if len(traj_pos) > 0:
        actions.append([line_indexes[-1], 'trajectory', traj_pos, traj_reversed])
        traj_pos = []

    search_length = 2
    allowed_search = ['acceleration', 'split']
    config = trajectory.TrajectoryConfig(AUTO_MAX_SPEED, AUTO_MAX_ACCEL)
    d = []
    # print(actions)
    for i, action in enumerate(actions):
        if action[1] == 'trajectory':
            s_vel, e_vel = 0, 0
            for j in range(i - 1, max(-1, i - search_length), -1):
                if actions[j][1] not in allowed_search:
                    break
                if actions[j][1] == 'split':
                    s_vel = actions[j][2]
            for j in range(i + 1, min(len(actions), i + search_length)):
                if actions[j][1] not in allowed_search:
                    break
                if actions[j][1] == 'split':
                    e_vel = actions[j][2]
            config.setStartVelocity(s_vel)
            config.setEndVelocity(e_vel)
            config.setReversed(action[3])
            traj = trajectory.TrajectoryGenerator.generateTrajectory(action[2], config)
            traj_d = {}
            traj_d["code_loc"] = {
                'start': (actions[i - 1][0] + 1 if i > 0 else 0) + 1, 
                'end': action[0] + 1
            }
            traj_d['states'] = [
                {
                    't': state.t,
                    'x': state.pose.x,
                    'y': state.pose.y,
                    'angle': state.pose.rotation().degrees(),
                    'vel': state.velocity
                } for state in traj.states()
            ]

            d.append(traj_d)

        if action[1] == 'acceleration':
            config = trajectory.TrajectoryConfig(AUTO_MAX_SPEED, actions[2])
    return d