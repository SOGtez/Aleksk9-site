"""Exports every model in the open .blend to public/game/models/<name>.glb.

A model is any Empty at the top level (no parent) with its parts under it; the file is named after the Empty.
After editing chat-survivors.blend by hand, run:
  /Applications/Blender.app/Contents/MacOS/Blender blender/chat-survivors.blend --background --python blender/export_models.py
(or open the Scripting tab in Blender, load this file and press Run).
"""
import bpy, os

OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'game', 'models'))


def export_all():
    os.makedirs(OUT, exist_ok=True)
    roots = [o for o in bpy.data.objects if o.type == 'EMPTY' and o.parent is None]
    for root in roots:
        saved = root.location.copy()
        root.location = (0, 0, 0)                       # each model is exported standing at the origin
        bpy.context.view_layer.update()
        bpy.ops.object.select_all(action='DESELECT')
        root.select_set(True)
        for c in root.children_recursive:
            c.select_set(True)
        path = os.path.join(OUT, root.name + '.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                                  export_yup=True, export_materials='EXPORT')
        root.location = saved
        print('Exported', path)


if __name__ == '__main__':
    export_all()
