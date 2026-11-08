import bpy
import bmesh
import math
import os
import random
from mathutils import Vector

# Pip — self-contained Blender 5.x scene. Frame 151 is a loop-closure key.
MODE = os.environ.get("PIP_MODE", "anim").strip().lower()
if MODE not in {"anim", "hero"}:
    raise ValueError("PIP_MODE must be 'anim' or 'hero'.")
RES = max(16, int(os.environ.get("PIP_RES", "1080" if MODE == "anim" else "1600")))
SAMPLES = max(1, int(os.environ.get("PIP_SAMPLES", "16")))
START = int(os.environ.get("PIP_FRAME_START", "1"))
LOOP = int(os.environ.get("PIP_LOOP", "150"))
END = int(os.environ.get("PIP_FRAME_END", str(LOOP)))
FRAME = int(os.environ.get("PIP_FRAME", "38"))
if not 1 <= START <= END <= LOOP:
    raise ValueError("Animation range must satisfy 1 <= start <= end <= 150.")
if not 1 <= FRAME <= LOOP:
    raise ValueError("PIP_FRAME must be between 1 and 150.")
OUT = os.path.abspath(os.path.expanduser(
    os.environ.get("PIP_OUT") or ("./frames/pip_" if MODE == "anim" else "./pip.png")))
if MODE == "hero" and not OUT.lower().endswith(".png"):
    OUT += ".png"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
random.seed(21)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = START, END
scene.render.fps = 30
try:
    scene.render.engine = 'BLENDER_EEVEE'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
if hasattr(scene, "eevee"):
    if hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = SAMPLES
    if hasattr(scene.eevee, "use_shadows"):
        scene.eevee.use_shadows = True
scene.render.resolution_x = scene.render.resolution_y = RES
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA' if MODE == "hero" else 'RGB'
scene.render.film_transparent = MODE == "hero"
scene.render.filepath = OUT
scene.render.use_file_extension = True
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'


def linear(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
                 for c in values)


def material(name, color, roughness=0.45, emission=0, coat=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    rgb = linear(color)
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*rgb, 1)
    bs.inputs["Roughness"].default_value = roughness
    bs.inputs["Specular IOR Level"].default_value = 0.3
    bs.inputs["Sheen Weight"].default_value = 0
    bs.inputs["Coat Weight"].default_value = coat
    if emission:
        bs.inputs["Emission Color"].default_value = (*rgb, 1)
        bs.inputs["Emission Strength"].default_value = emission
    mat.diffuse_color = (*rgb, 1)
    return mat


blue = material("Sky-blue glossy toy", "#6FC3FF", 0.25, coat=0.22)
cream = material("Cream clay", "#FFF7E8", 0.45)
navy = material("Friendly navy face", "#14214D", 0.38)
rubber = material("Soft dark wheels", "#1C2238", 0.65)
gold = material("Luminous gold", "#FFD36E", 0.28, emission=8)
stem_mat = material("Antenna gold", "#FFD36E", 0.35)
white = material("Eye catchlights", "#FFFFFF", 0.3, emission=1.5)


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


def finish(obj, name, mat, parent=None):
    obj.name = name
    obj.parent = parent
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def sphere(name, location, scale, mat, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=48, ring_count=32, radius=1, location=location)
    obj = finish(bpy.context.object, name, mat, parent)
    obj.scale = scale
    return obj


def cylinder(name, location, radius, depth, mat, parent=None, axis_x=False):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48, radius=radius, depth=depth, location=location)
    obj = finish(bpy.context.object, name, mat, parent)
    if axis_x:
        obj.rotation_euler.y = math.pi / 2
    bevel = obj.modifiers.new("Rounded edges", 'BEVEL')
    bevel.width = min(radius * 0.22, depth * 0.18)
    bevel.segments = 3
    obj.modifiers.new("Weighted normals", 'WEIGHTED_NORMAL')
    return obj


root = empty("Pip — whole mascot")
sphere("Squishy blue body", (0, 0, 0.405), (0.30, 0.225, 0.28), blue, root)
sphere("Round cream head", (0, -0.008, 0.83), (0.28, 0.245, 0.255), cream, root)
for side in (-1, 1):
    cylinder("Wheel L" if side < 0 else "Wheel R",
             (side * 0.245, 0, 0.135), 0.135, 0.105, rubber, root, True)
    cylinder("Blue wheel hub", (side * 0.302, 0, 0.135),
             0.063, 0.014, blue, root, True)
    x = side * 0.094
    sphere("Oval eye", (x, -0.235, 0.855), (0.040, 0.028, 0.061), navy, root)
    sphere("Tiny eye glint", (x - 0.010, -0.261, 0.876),
           (0.0085, 0.005, 0.010), white, root)

# Smile follows the curved head surface rather than floating in a flat plane.
curve = bpy.data.curves.new("Smile arc geometry", 'CURVE')
curve.dimensions = '3D'
curve.resolution_u = 2
curve.bevel_depth = 0.009
curve.bevel_resolution = 4
curve.use_fill_caps = True
spline = curve.splines.new('POLY')
spline.points.add(32)
for i, point in enumerate(spline.points):
    angle = math.pi + math.pi * i / 32
    x = 0.066 * math.cos(angle)
    z = 0.787 + 0.053 * math.sin(angle)
    y = -0.008 - 0.245 * math.sqrt(1 - (x / 0.28) ** 2 -
                                    ((z - 0.83) / 0.255) ** 2) - 0.007
    point.co = (x, y, z, 1)
smile = bpy.data.objects.new("Little curved smile", curve)
scene.collection.objects.link(smile)
smile.parent = root
curve.materials.append(navy)

right = empty("Right shoulder — waving", (-0.285, 0, 0.55), root)
left = empty("Left shoulder — relaxed", (0.285, 0, 0.55), root)
for shoulder in (right, left):
    sphere("Rounded shoulder", (0, 0, 0), (0.072, 0.075, 0.072), blue, shoulder)
    sphere("Capsule arm", (0, 0, -0.125), (0.065, 0.069, 0.151), blue, shoulder)

cylinder("Short antenna stem", (0, 0, 1.115), 0.018, 0.105, stem_mat, root)
star_pivot = empty("Antenna star pivot", (0, 0, 1.205), root)

# Ten alternating vertices, a filled face, then a true bmesh extrusion.
bm = bmesh.new()
verts = []
for i in range(10):
    angle = math.pi / 2 + i * math.pi / 5
    radius = 0.103 if i % 2 == 0 else 0.048
    verts.append(bm.verts.new((radius * math.cos(angle), -0.018,
                              radius * math.sin(angle))))
face = bm.faces.new(verts)
extruded = bmesh.ops.extrude_face_region(bm, geom=[face])
bmesh.ops.translate(bm, verts=[v for v in extruded["geom"]
                              if isinstance(v, bmesh.types.BMVert)],
                    vec=Vector((0, 0.036, 0)))
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
mesh = bpy.data.meshes.new("Extruded five-point star mesh")
bm.to_mesh(mesh)
bm.free()
star = bpy.data.objects.new("Five-point glowing antenna star", mesh)
scene.collection.objects.link(star)
finish(star, star.name, gold, star_pivot)
bevel = star.modifiers.new("Soft star edges", 'BEVEL')
bevel.width, bevel.segments = 0.004, 3
star.modifiers.new("Star weighted normals", 'WEIGHTED_NORMAL')


def light(name, kind, location, energy, color, size, target=None, parent=None):
    data = bpy.data.lights.new(name, kind)
    data.energy, data.color = energy, linear(color)
    if kind == 'AREA':
        data.shape, data.size = 'DISK', size
    else:
        data.shadow_soft_size = size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.parent, obj.location = parent, location
    if target is not None:
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    return obj


light("Warm antenna glow", 'POINT', (0, -0.025, 1.205), 20, "#FFD36E", 0.10, parent=root)
light("Large soft key", 'AREA', (-2.4, -3.2, 4), 240, "#FFF2E0", 3, (0, 0, 0.65))
light("Soft frontal fill", 'AREA', (2.2, -2.5, 1.9), 100, "#D6E8FF", 2.5, (0, 0, 0.65))
light("Blue rim", 'AREA', (1.9, 1.4, 2.5), 240, "#83B6FF", 2, (0, 0, 0.75))

world = bpy.data.worlds.new("Deep navy world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (*linear("#0B1A4A"), 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1
scene.world = world

bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 2.2, 0.72),
                                rotation=(math.pi / 2, 0, 0))
backdrop = bpy.context.object
backdrop.name = "Seamless radial blue backdrop"
backdrop.hide_render = MODE == "hero"
mat = bpy.data.materials.new("Royal blue radial emission")
mat.use_nodes = True
nodes, links = mat.node_tree.nodes, mat.node_tree.links
nodes.clear()
tex = nodes.new("ShaderNodeTexCoord")
distance = nodes.new("ShaderNodeVectorMath")
distance.operation = 'LENGTH'
divide = nodes.new("ShaderNodeMath")
divide.operation = 'DIVIDE'
divide.inputs[1].default_value = 2.6
ramp = nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.interpolation = 'EASE'
ramp.color_ramp.elements[0].color = (*linear("#1F3FA6"), 1)
ramp.color_ramp.elements[1].position = 0.95
ramp.color_ramp.elements[1].color = (*linear("#0B1A4A"), 1)
emission = nodes.new("ShaderNodeEmission")
emission.inputs["Strength"].default_value = 1
output = nodes.new("ShaderNodeOutputMaterial")
links.new(tex.outputs["Object"], distance.inputs[0])
links.new(distance.outputs["Value"], divide.inputs[0])
links.new(divide.outputs[0], ramp.inputs[0])
links.new(ramp.outputs["Color"], emission.inputs["Color"])
links.new(emission.outputs[0], output.inputs["Surface"])
backdrop.data.materials.append(mat)

sparkles = []
for i in range(9):
    x = (-1 if i % 2 == 0 else 1) * random.uniform(0.37, 0.83)
    y = random.uniform(0.25, 0.8)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    obj = finish(bpy.context.object, "Gold sparkle %02d" % i, gold)
    obj.hide_render = MODE == "hero" and i >= 5
    sparkles.append((obj, x, y, i / 9, random.uniform(0.010, 0.019)))

focus = empty("Camera focus", (0, 0, 0.72))
cam_data = bpy.data.cameras.new("Pip portrait camera")
cam = bpy.data.objects.new("Pip portrait camera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (0, -4.4, 1.45)
cam.rotation_euler = (Vector((0, 0, 0.70)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam_data.type, cam_data.lens = 'PERSP', 78
cam_data.sensor_width, cam_data.sensor_fit = 36, 'HORIZONTAL'
cam_data.clip_start, cam_data.clip_end = 0.05, 300
cam_data.dof.use_dof = True
cam_data.dof.focus_object = focus
cam_data.dof.aperture_fstop = 4
cam_data.dof.aperture_blades = 7

# Bake every frame with linear interpolation; the extra closure key makes 151 == 1.
for frame in range(1, LOOP + 2):
    p = (frame - 1) / LOOP
    t = 2 * math.pi * (0 if frame == 151 else p)
    root.location.z = 0.052 * (1 - math.cos(2 * t))
    root.rotation_euler.z = math.radians(15) * math.sin(t)
    right.rotation_euler.y = math.radians(140 + 25 * math.sin(3 * t))
    left.rotation_euler.y = math.radians(-12 + 4 * math.sin(t + 0.5))
    star_pivot.rotation_euler.y = 0.32 * math.sin(t)
    star_pivot.scale = (1 + 0.08 * math.sin(2 * t),) * 3
    for obj, paths in ((root, ("location", "rotation_euler")),
                       (right, ("rotation_euler",)), (left, ("rotation_euler",)),
                       (star_pivot, ("rotation_euler", "scale"))):
        for path in paths:
            obj.keyframe_insert(data_path=path, frame=frame)
    for obj, x, y, offset, size in sparkles:
        u = ((0 if frame == 151 else p) + offset) % 1
        obj.location = (x + 0.045 * math.sin(t + offset * 2 * math.pi),
                        y, -0.10 + 1.65 * u)
        obj.scale = (size * math.sin(math.pi * u),) * 3
        obj.keyframe_insert(data_path="location", frame=frame)
        obj.keyframe_insert(data_path="scale", frame=frame)

# Blender 5.x standalone compositor with socket-based glare.
ng = bpy.data.node_groups.new("Pip bloom compositor", "CompositorNodeTree")
ng.interface.new_socket(name="Image", in_out='OUTPUT', socket_type='NodeSocketColor')
rl = ng.nodes.new("CompositorNodeRLayers")
rl.location = (-280, 0)
glare = ng.nodes.new("CompositorNodeGlare")
glare.location = (-40, 0)
try:
    glare.inputs["Type"].default_value = 'Fog Glow'
except (TypeError, ValueError):
    glare.inputs["Type"].default_value = 'Bloom'
glare.inputs["Quality"].default_value = os.environ.get("PIP_GLARE_Q", 'High')
glare.inputs["Threshold"].default_value = 1.0
glare.inputs["Strength"].default_value = 0.8
glare.inputs["Size"].default_value = 0.75
output = ng.nodes.new("NodeGroupOutput")
output.location = (200, 0)
ng.links.new(rl.outputs["Image"], glare.inputs["Image"])
ng.links.new(glare.outputs["Image"], output.inputs["Image"])
scene.compositing_node_group = ng

scene.frame_set(FRAME if MODE == "hero" else START)
bpy.context.view_layer.update()
if MODE == "hero":
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("Pip: mode=%s resolution=%dx%d samples=%d frames=%s output=%s" %
      (MODE, RES, RES, SAMPLES, str(FRAME) if MODE == "hero" else
       "%d..%d" % (START, END), OUT))
