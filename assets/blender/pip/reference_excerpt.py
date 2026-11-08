import bpy
import math
import os
import random
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

# Nightlight Press — stage-screen colour revision.
# Example:
# NL_OUT=/absolute/path/nightlight.png blender -b --factory-startup -P script.py

OUT = os.environ.get("NL_OUT")
if not OUT:
    raise RuntimeError("NL_OUT must be a full output PNG path.")
OUT = os.path.abspath(OUT)
os.makedirs(os.path.dirname(OUT), exist_ok=True)

RES_X = int(os.environ.get("NL_RES_X", "2400"))
RES_Y = int(os.environ.get("NL_RES_Y", "1260"))
SAMPLES = max(1, min(32, int(os.environ.get("NL_SAMPLES", "32"))))
FRAME = int(os.environ.get("NL_FRAME", "48"))
random.seed(21)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 48
scene.render.fps = 24
try:
    scene.render.engine = 'BLENDER_EEVEE'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'

if hasattr(scene, "eevee"):
    if hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = SAMPLES
    if hasattr(scene.eevee, "use_shadows"):
        scene.eevee.use_shadows = True

scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.film_transparent = False
scene.render.filepath = OUT

scene.view_settings.view_transform = 'Standard'
# ...

def material(name, color, roughness=0.66, emission=0.0,
             grain=False, emission_color=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Roughness"].default_value = roughness
    bs.inputs["Specular IOR Level"].default_value = 0.3
    bs.inputs["Sheen Weight"].default_value = 0.0
    if emission:
        bs.inputs["Emission Color"].default_value = (
            *(emission_color if emission_color is not None else color), 1)
        bs.inputs["Emission Strength"].default_value = emission
    if grain:
        noise = mat.node_tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 100
        noise.inputs["Detail"].default_value = 2
        bump = mat.node_tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.04
        bump.inputs["Distance"].default_value = 0.015
        mat.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        mat.node_tree.links.new(bump.outputs["Normal"], bs.inputs["Normal"])
    mat.diffuse_color = (*color, 1)
    return mat


# ...

world = bpy.data.worlds.new("Warm cream morning world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (
    1.0, 0.94, 0.84, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
scene.world = world

# ...
scene.collection.objects.link(cam)
scene.camera = cam
cam_data.type = 'PERSP'
cam_data.lens = 70
cam_data.sensor_width = 36
cam_data.sensor_fit = 'HORIZONTAL'
cam_data.clip_end = 300
cam_data.dof.use_dof = True
cam_data.dof.focus_object = focus
cam_data.dof.aperture_fstop = 2.4
cam_data.dof.aperture_blades = 7

# ALWAYS fit the hero pose. NL_FRAME changes the animation, never the framing.
scene.frame_set(48)
# ...
# Blender 5.x compositor: standalone group, group output and socket-based glare.
ng = bpy.data.node_groups.new("NL_Comp", "CompositorNodeTree")
ng.interface.new_socket(
    name="Image", in_out='OUTPUT', socket_type='NodeSocketColor')

rl = ng.nodes.new("CompositorNodeRLayers")
rl.location = (-280, 0)
glare = ng.nodes.new("CompositorNodeGlare")
glare.location = (-40, 0)
try:
    glare.inputs["Type"].default_value = 'Fog Glow'
except (TypeError, ValueError):
    glare.inputs["Type"].default_value = 'Bloom'
glare.inputs["Quality"].default_value = 'High'
glare.inputs["Threshold"].default_value = 1.0
glare.inputs["Strength"].default_value = 0.85
glare.inputs["Size"].default_value = 0.75

output = ng.nodes.new("NodeGroupOutput")
output.location = (200, 0)
ng.links.new(rl.outputs["Image"], glare.inputs["Image"])
ng.links.new(glare.outputs["Image"], output.inputs["Image"])
scene.compositing_node_group = ng

# Render the requested animation frame using the fixed frame-48 composition.
scene.frame_set(FRAME)
bpy.context.view_layer.update()
mesh_count = sum(obj.type == 'MESH' for obj in scene.objects)
bpy.ops.render.render(write_still=True)

print(
    "Nightlight Press: Standard colour revision; frame %d, %dx%d, "
    "%d samples, %d meshes / %d objects; framing locked to frame 48 -> %s"
