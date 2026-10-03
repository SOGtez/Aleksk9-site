"""Chat Survivors: builds every 3D model for the game in Blender and exports them for the website.

Run (from the repo folder):
  /Applications/Blender.app/Contents/MacOS/Blender --background --python blender/build_models.py

It writes:
  blender/chat-survivors.blend      all models side by side, open it in Blender to look or edit
  public/game/models/<name>.glb     one file per model, loaded by the game

To change a model by hand: open chat-survivors.blend, edit it (each model is an Empty with its parts under it,
named after the model), save, then run blender/export_models.py (see that file).

Conventions the game relies on:
  - 1 Blender unit = the character's radius in the game. Bodies sit on the ground (z = 0).
  - Models face -Y in Blender (front view), which becomes +Z in the game.
  - Named parts the game looks for: Aleks has "Gun" and "Hammer" (shown for the current weapon);
    materials named "WeaponTip", "Accent" and "Spark" are recoloured or made to glow by the game.
"""
import bpy, bmesh, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from export_models import export_all  # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------- materials ----------
def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mat(name, hexcol, rough=0.55, emit=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    h = hexcol.lstrip('#')
    rgb = tuple(lin(int(h[i:i + 2], 16)) for i in (0, 2, 4))
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*rgb, 1)
        bsdf.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*rgb, 1)
    return m


INK = '#0a0708'
WHITE = '#ffffff'


# ---------- shapes ----------
def _finish(o, material, smooth=True, name=None):
    if name:
        o.name = name
    o.data.materials.append(material)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def sphere(loc, scale, material, seg=32, name=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1, location=loc, scale=scale)
    return _finish(bpy.context.object, material, True, name)


def cyl(loc, r, depth, material, rot=(0, 0, 0), seg=32, name=None, smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=loc, rotation=rot)
    return _finish(bpy.context.object, material, smooth, name)


def cone(loc, r1, r2, depth, material, rot=(0, 0, 0), seg=24, name=None):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    return _finish(bpy.context.object, material, True, name)


def box(loc, size, material, rot=(0, 0, 0), bevel=0.0, name=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot, scale=size)
    o = _finish(bpy.context.object, material, False, name)
    if bevel:
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        mod = o.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def torus(loc, major, minor, material, rot=(0, 0, 0), name=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=40, minor_segments=12,
                                     location=loc, rotation=rot)
    return _finish(bpy.context.object, material, True, name)


def cut_below(o, z, above=False):
    """Delete the part of a mesh below height z above its centre (above=True: delete above instead).
    Makes domes, hoods, hair and half-ring mouths. Rotation and scale are applied first so z means up."""
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if (v.co.z > z if above else v.co.z < z)], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    return o


def eyes(z, front, spread, size, angry=False, pupil=INK, look_down=0.0):
    """Big cartoon eyes on the front (-Y) of a head or body."""
    parts = []
    for sx in (-1, 1):
        x = sx * spread
        parts.append(sphere((x, -front, z), (size, size * 0.55, size * 1.15), mat('EyeWhite', WHITE, 0.3)))
        parts.append(sphere((x, -front - size * 0.42, z - size * 0.15 - look_down), (size * 0.5, size * 0.3, size * 0.55),
                            mat('Pupil' if pupil == INK else 'PupilRed', pupil, 0.3)))
        parts.append(sphere((x - size * 0.18, -front - size * 0.62, z + size * 0.1 - look_down), (size * 0.15,) * 3,
                            mat('EyeWhite', WHITE, 0.3), seg=12))
        if angry:
            parts.append(box((x, -front - size * 0.3, z + size * 1.25), (size * 1.5, size * 0.3, size * 0.32),
                             mat('Ink', INK), rot=(0, sx * 0.45, 0)))
    return parts


def feet(spread=0.4, colour='#1a1214', size=0.28):
    return [sphere((sx * spread, -0.1, size * 0.55), (size, size * 1.35, size * 0.6), mat('Shoe', colour)) for sx in (-1, 1)]


# ---------- assembling ----------
MODELS = []


def model(name, parts, keep=()):
    """Join the parts into one mesh (except named ones in keep) and put everything under an Empty called name."""
    bpy.ops.object.select_all(action='DESELECT')
    body = [p for p in parts if p.name not in keep]
    kept = [p for p in parts if p.name in keep]           # (read before joining: joined parts stop existing)
    for p in body:
        p.select_set(True)
    bpy.context.view_layer.objects.active = body[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name + '_Body'
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)   # clean scale 1 for the game's outlines
    root = bpy.data.objects.new(name, None)
    root.empty_display_size = 1.2
    scene.collection.objects.link(root)
    for p in [joined] + kept:
        p.parent = root
    MODELS.append(root)
    return root


def join_parts(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return o


# ---------- the models ----------
def aleks():
    hoodie, skin, hair, red2 = mat('Hoodie', '#E10600'), mat('Skin', '#ffd9b8'), mat('Hair', '#1a1214'), mat('Headset', '#ff3b30')
    p = [sphere((0, 0, 0.85), (1, 0.92, 0.85), hoodie)]
    p.append(torus((0, 0, 1.38), 0.55, 0.16, hoodie))                                   # hood around the neck
    p.append(sphere((0, -0.86, 0.75), (0.32, 0.1, 0.25), mat('Pocket', '#b80500')))       # hoodie pocket
    p.append(sphere((0, 0, 1.85), (0.72, 0.72, 0.7), skin))                              # head
    p.append(cut_below(sphere((0, 0.1, 1.95), (0.78, 0.78, 0.74), hair), 0.32))          # hair cap
    p.append(cone((0.18, -0.5, 2.36), 0.2, 0, 0.42, hair, rot=(-1.1, 0.3, 0)))            # fringe spikes
    p.append(cone((-0.15, -0.46, 2.38), 0.18, 0, 0.38, hair, rot=(-1.1, -0.4, 0)))
    p.append(cut_below(torus((0, 0.05, 1.86), 0.8, 0.07, mat('Ink', INK), rot=(math.pi / 2, 0, 0)), 0.0))  # headset band
    for sx in (-1, 1):
        p.append(cyl((sx * 0.76, 0, 1.82), 0.24, 0.2, red2, rot=(0, math.pi / 2, 0)))
    p.append(cyl((-0.68, -0.38, 1.6), 0.03, 0.55, mat('Ink', INK), rot=(1.2, 0, 0.6)))   # mic boom
    p.append(sphere((-0.5, -0.62, 1.48), (0.08,) * 3, mat('Ink', INK), seg=12))
    p += eyes(1.92, 0.62, 0.25, 0.2)
    p.append(cut_below(torus((0, -0.7, 1.66), 0.14, 0.035, mat('Mouth', '#3a0b12'), rot=(math.pi / 2, 0, 0)), 0.0, above=True))  # smile
    p += feet()
    hand = sphere((0.72, -0.45, 0.95), (0.2,) * 3, skin)
    p.append(hand)
    p.append(sphere((-0.82, -0.1, 0.85), (0.2,) * 3, skin))
    # weapons, kept as separate parts so the game can show one or the other
    gun = join_parts([box((0.72, -0.95, 1.0), (0.26, 0.9, 0.3), mat('Gun', '#2a2a2e'), bevel=0.05),
                      box((0.72, -0.6, 0.8), (0.18, 0.2, 0.36), mat('Gun', '#2a2a2e'), bevel=0.04),
                      sphere((0.72, -1.45, 1.0), (0.17,) * 3, mat('WeaponTip', WHITE, 0.3, emit=1.0))], 'Gun')
    hammer = join_parts([cyl((0.72, -1.0, 1.0), 0.07, 1.2, mat('Wood', '#6b4a2b'), rot=(math.pi / 2, 0, 0)),
                         box((0.72, -1.62, 1.0), (0.42, 0.42, 0.72), mat('Steel', '#d9d9de', 0.35), bevel=0.06)], 'Hammer')
    p += [gun, hammer]
    return model('aleks', p, keep=('Gun', 'Hammer'))


def blob_body(colour, name, sy=1.0, sz=0.95):
    return sphere((0, 0, sz), (1, sy, sz), mat(name, colour))


def lurker():
    p = [blob_body('#8d8da3', 'Lurker')]
    p.append(cut_below(sphere((0, 0.06, 1.0), (1.08, 1.04, 1.02), mat('LurkerHood', '#55556a')), 0.1))
    p += eyes(0.78, 0.86, 0.3, 0.2, look_down=0.04)
    p.append(box((0, -0.97, 0.45), (0.35, 0.05, 0.05), mat('Ink', INK)))
    p += feet(0.42, '#3c3c4a', 0.25)
    return model('lurker', p)


def spammer():
    yellow = mat('Spammer', '#ffc233')
    p = [blob_body('#ffc233', 'Spammer')]
    p += eyes(1.12, 0.8, 0.33, 0.3)
    p.append(sphere((0, -0.9, 0.55), (0.32, 0.14, 0.26), mat('Mouth', '#3a0b12')))
    p.append(cone((-0.3, 0, 1.95), 0.22, 0, 0.6, yellow, rot=(0, -0.5, 0)))
    p.append(cone((0.05, 0, 2.0), 0.2, 0, 0.55, yellow, rot=(0, 0.15, 0)))
    p += feet(0.4, '#7a5a00', 0.22)
    return model('spammer', p)


def backseat():
    ink = mat('Ink', INK)
    p = [blob_body('#4cc3ff', 'Backseat')]
    p += eyes(1.08, 0.8, 0.32, 0.24)
    for sx in (-1, 1):
        p.append(torus((sx * 0.32, -1.02, 1.1), 0.27, 0.05, ink, rot=(math.pi / 2, 0, 0)))
    p.append(box((0, -1.04, 1.12), (0.2, 0.05, 0.05), ink))
    p.append(torus((0, -0.86, 0.6), 0.2, 0.04, mat('Mouth', '#3a0b12'), rot=(math.pi / 2, 0, 0)))
    p += feet(0.4, '#1d5f80', 0.24)
    return model('backseat', p)


def troll():
    purple = mat('Troll', '#b455ff')
    p = [sphere((0, 0, 1.0), (1.05, 1, 1.0), purple)]
    for sx in (-1, 1):
        p.append(cone((sx * 0.6, 0, 1.95), 0.26, 0, 0.75, mat('Horn', '#e8dcc8'), rot=(0, sx * 0.55, 0)))
    p += eyes(1.18, 0.85, 0.32, 0.24, angry=True)
    p.append(box((0, -0.93, 0.58), (0.7, 0.1, 0.22), mat('Mouth', '#3a0b12')))
    for sx in (-1, 1):
        p.append(box((sx * 0.17, -0.99, 0.62), (0.16, 0.06, 0.16), mat('Tooth', WHITE)))
    p += feet(0.45, '#5a2580', 0.3)
    return model('troll', p)


def bomber():
    p = [blob_body('#ff5a4e', 'Bomber')]
    p += eyes(1.05, 0.82, 0.3, 0.24)
    p.append(sphere((0, -0.9, 0.55), (0.24, 0.12, 0.2), mat('Mouth', '#3a0b12')))
    p.append(cyl((0, 0, 2.0), 0.28, 0.25, mat('Cap', '#3a3a40')))
    p.append(cyl((0.12, 0, 2.35), 0.05, 0.5, mat('Fuse', '#b08a5a'), rot=(0, 0.45, 0)))
    p.append(sphere((0.25, 0, 2.62), (0.16,) * 3, mat('Spark', '#ffd166', 0.2, emit=3.0)))
    p += feet(0.4, '#7a1f18', 0.24)
    return model('bomber', p)


def boss():
    gold = mat('Gold', '#ffd166', 0.3)
    p = [sphere((0, 0, 1.0), (1, 0.95, 1.0), mat('Doomer', '#2b0d12'))]
    p.append(cyl((0, 0, 1.92), 0.62, 0.3, gold))
    for i in range(5):
        a = i / 5 * math.tau
        p.append(cone((math.cos(a) * 0.5, math.sin(a) * 0.5, 2.3), 0.16, 0, 0.5, gold))
        p.append(sphere((math.cos(a) * 0.5, math.sin(a) * 0.5, 2.58), (0.07,) * 3, mat('Ruby', '#ff3b30', 0.2), seg=12))
    p += eyes(1.15, 0.82, 0.32, 0.24, angry=True, pupil='#ff3b30')
    p.append(cut_below(torus((0, -0.86, 0.45), 0.3, 0.05, mat('Mouth', '#3a0b12'), rot=(math.pi / 2, 0, 0)), 0.0))
    p.append(sphere((0, 0.6, 1.2), (0.95, 0.5, 0.9), mat('Cape', '#5a0c14')))
    p += feet(0.45, '#14060a', 0.3)
    return model('boss', p)


def crate():
    wood, dark, gold = mat('Wood', '#c98a2e'), mat('WoodDark', '#8a5a1c'), mat('Gold', '#ffd166', 0.3)
    p = [box((0, 0, 1), (1.9, 1.9, 1.9), wood)]
    e = 1.0
    for x in (-e, e):
        for y in (-e, e):
            p.append(box((x * 0.95, y * 0.95, 1), (0.22, 0.22, 2.0), dark))
    for z in (0.05, 1.95):
        for y in (-0.95, 0.95):
            p.append(box((0, y, z), (2.0, 0.22, 0.22), dark))
        for x in (-0.95, 0.95):
            p.append(box((x, 0, z), (0.22, 2.0, 0.22), dark))
    for y in (-1, 1):
        p.append(box((0, y * 0.98, 1.4), (1.2, 0.08, 0.3), gold))
    return model('crate', p)


def coin():
    gold = mat('Gold', '#ffd166', 0.3)
    p = [cyl((0, 0, 1), 1, 0.25, gold, rot=(math.pi / 2, 0, 0), seg=40)]
    p.append(cyl((0, 0, 1), 0.68, 0.32, mat('GoldDark', '#d9a53a', 0.3), rot=(math.pi / 2, 0, 0), seg=40))
    return model('coin', p)


def heart():
    red = mat('Heart', '#ff3b30', 0.35)
    p = [sphere((sx * 0.42, 0, 1.3), (0.58, 0.4, 0.58), red) for sx in (-1, 1)]
    p.append(cone((0, 0, 0.75), 0.98, 0, 1.15, red, rot=(math.pi, 0, 0), seg=32))
    p[-1].scale = (1, 0.42, 1)
    return model('heart', p)


def key():
    gold = mat('Gold', '#ffd166', 0.3)
    p = [torus((-0.6, 0, 1), 0.42, 0.15, gold, rot=(math.pi / 2, 0, 0))]
    p.append(cyl((0.35, 0, 1), 0.12, 1.3, gold, rot=(0, math.pi / 2, 0)))
    p.append(box((0.82, 0, 0.75), (0.16, 0.2, 0.42), gold))
    p.append(box((0.5, 0, 0.8), (0.16, 0.2, 0.3), gold))
    return model('key', p)


def weaponbox():
    p = [box((0, 0, 0.6), (1.8, 1.3, 1.1), mat('Case', '#1c1a1f'), bevel=0.12)]
    p.append(box((0, -0.66, 0.6), (1.4, 0.04, 0.75), mat('Accent', WHITE, 0.3, emit=1.5), bevel=0.04))
    p.append(box((0, 0, 1.16), (1.4, 0.9, 0.04), mat('Accent', WHITE, 0.3, emit=1.5), bevel=0.02))
    p.append(cyl((0, 0, 1.3), 0.28, 0.2, mat('Case', '#1c1a1f')))
    return model('weaponbox', p)


builders = [aleks, lurker, spammer, backseat, troll, bomber, boss, crate, coin, heart, key, weaponbox]
for i, b in enumerate(builders):
    root = b()
    root.location.x = i * 3.2          # side by side in the .blend; the export puts each one back at the origin

blend = os.path.join(HERE, 'chat-survivors.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)
export_all()
print('Saved', blend)
