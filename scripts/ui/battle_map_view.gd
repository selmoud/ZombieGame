class_name BattleMapView
extends Control
## Draws the mission as a minimal map: flat pale terrain with smooth edges, bold
## geometric shapes for units, thick lines for roads and routes. Enemy units
## themselves are never read here, only Battle.contacts.

signal map_clicked(position: Vector2, button: MouseButton)

const CELL := 16.0

const COLOR_LAND := Color("f4f0e6")
const COLOR_WATER := Color("c5dbe6")
const COLOR_FOREST := Color("dce6d0")
const COLOR_TOWN := Color("e0dcd3")
const COLOR_HILL_LOW := Color("ede6d6")
const COLOR_HILL_HIGH := Color("d9ccb1")
const COLOR_ROAD := Color("c6bfb1")
const COLOR_INK := Color("32343a")
const COLOR_FAINT := Color("b9b3a6")
const COLOR_OWN := Color("2456a8")
const COLOR_ENEMY := Color("e2372f")
const COLOR_NEUTRAL := Color("9a958b")
const COLOR_STRIKE := Color("f2a900")

const SHAPE_RADIUS := 11.0
const RING_RADIUS := 17.0
const CONTACT_RADIUS := 8.0
const PICK_RADIUS := 16.0
const ROAD_WIDTH := 5.0

## Terrain is drawn by the GPU from a tiny mask, one texel per cell: red is water,
## green forest, blue hill height, alpha town. Smooth sampling rounds every edge.
const GROUND_SHADER := "
shader_type canvas_item;
uniform sampler2D mask : filter_linear, repeat_disable;
uniform vec3 land : source_color;
uniform vec3 water : source_color;
uniform vec3 forest : source_color;
uniform vec3 town : source_color;
uniform vec3 hill_low : source_color;
uniform vec3 hill_high : source_color;

float edge(float value, float level) {
	float soft = max(fwidth(value), 0.0005);
	return smoothstep(level - soft, level + soft, value);
}

void fragment() {
	vec4 cell = texture(mask, UV);
	vec3 color = land;
	color = mix(color, town, edge(cell.a, 0.5));
	color = mix(color, hill_low, edge(cell.b, 0.125));
	color = mix(color, mix(hill_low, hill_high, 0.5), edge(cell.b, 0.375));
	color = mix(color, hill_high, edge(cell.b, 0.625));
	color = mix(color, forest, edge(cell.g, 0.5));
	color = mix(color, water, edge(cell.r, 0.5));
	COLOR = vec4(color, 1.0);
}
"

var battle: Battle
var selected_unit := -1
## While true the cursor shows where an artillery strike would land.
var strike_mode := false

var _ground: ColorRect
var _font: Font


func _ready() -> void:
	_font = get_theme_default_font()
	mouse_filter = Control.MOUSE_FILTER_STOP
	_ground = ColorRect.new()
	_ground.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ground.show_behind_parent = true
	var shader := Shader.new()
	shader.code = GROUND_SHADER
	var ground := ShaderMaterial.new()
	ground.shader = shader
	ground.set_shader_parameter("land", COLOR_LAND)
	ground.set_shader_parameter("water", COLOR_WATER)
	ground.set_shader_parameter("forest", COLOR_FOREST)
	ground.set_shader_parameter("town", COLOR_TOWN)
	ground.set_shader_parameter("hill_low", COLOR_HILL_LOW)
	ground.set_shader_parameter("hill_high", COLOR_HILL_HIGH)
	_ground.material = ground
	add_child(_ground)


func set_battle(new_battle: Battle) -> void:
	battle = new_battle
	custom_minimum_size = Vector2(battle.map.size) * CELL
	_ground.size = custom_minimum_size
	var ground := _ground.material as ShaderMaterial
	ground.set_shader_parameter("mask", ImageTexture.create_from_image(_terrain_mask()))
	queue_redraw()


func to_map(point: Vector2) -> Vector2:
	return point / CELL


func to_screen(position: Vector2) -> Vector2:
	return position * CELL


## Where the unit is shown, in map coordinates. Units standing together are spread
## sideways so every shape and call sign stays readable and clickable.
func shown_position(unit: BattleUnit) -> Vector2:
	var shift := 0
	for other in battle.units:
		if other.id >= unit.id:
			break
		if other.side == unit.side and other.is_on_map() and other.position.distance_to(unit.position) < 1.2:
			shift += 1
	return unit.position + Vector2(shift * 2.0 * (RING_RADIUS + 4.0) / CELL, 0.0)


## Player unit under the point, or -1.
func unit_at(position: Vector2) -> int:
	var best := -1
	var best_distance := PICK_RADIUS / CELL
	for unit in battle.units:
		if unit.side != BattleUnit.Side.PLAYER or not unit.is_on_map():
			continue
		var distance := shown_position(unit).distance_to(position)
		if distance <= best_distance:
			best_distance = distance
			best = unit.id
	return best


## Objective whose capture circle contains the point, or -1.
func objective_at(position: Vector2) -> int:
	for objective in battle.map.objectives:
		if BattleMap.cell_centre(objective.cell).distance_to(position) <= battle.rules.capture_radius:
			return objective.index
	return -1


func _gui_input(event: InputEvent) -> void:
	if battle == null:
		return
	if event is InputEventMouseButton:
		var click := event as InputEventMouseButton
		if click.pressed and click.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT]:
			map_clicked.emit(to_map(click.position), click.button_index)
			accept_event()
	elif event is InputEventMouseMotion and strike_mode:
		queue_redraw()


func _draw() -> void:
	if battle == null:
		return
	_draw_roads()
	_draw_grid()
	for objective in battle.map.objectives:
		_draw_objective(objective)
	for unit in battle.units:
		if unit.side == BattleUnit.Side.PLAYER and unit.is_on_map():
			_draw_route(unit)
	for strike in battle.strikes:
		_draw_strike(strike)
	_draw_impacts()
	for contact: Battle.Contact in battle.contacts.values():
		_draw_contact(contact)
	for unit in battle.units:
		if unit.side == BattleUnit.Side.PLAYER and unit.is_on_map():
			_draw_fire(unit)
	for unit in battle.units:
		if unit.side == BattleUnit.Side.PLAYER and unit.is_on_map():
			_draw_unit(unit)
	if strike_mode:
		_draw_strike_cursor()


# --- Terrain ----------------------------------------------------------------

func _terrain_mask() -> Image:
	var map := battle.map
	var depth := _hill_depth()
	var image := Image.create(map.size.x, map.size.y, false, Image.FORMAT_RGBA8)
	for y in map.size.y:
		for x in map.size.x:
			var type := map.get_terrain(Vector2i(x, y))
			var water := type == Terrain.Type.WATER or type == Terrain.Type.BRIDGE
			image.set_pixel(x, y, Color(
				1.0 if water else 0.0,
				1.0 if type == Terrain.Type.FOREST else 0.0,
				minf(depth[y * map.size.x + x] * 0.25, 1.0),
				1.0 if type == Terrain.Type.TOWN else 0.0
			))
	return image


## For every cell: 0 off a hill, otherwise how many cells deep inside the hill it lies.
func _hill_depth() -> PackedInt32Array:
	var map := battle.map
	var depth := PackedInt32Array()
	depth.resize(map.size.x * map.size.y)
	for level in range(1, 5):
		var changed := false
		for y in map.size.y:
			for x in map.size.x:
				var at := Vector2i(x, y)
				if map.get_terrain(at) != Terrain.Type.HILL or depth[y * map.size.x + x] != level - 1:
					continue
				var inside := level == 1
				if not inside:
					inside = true
					for step: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
						var next := at + step
						if not map.contains(next) or depth[next.y * map.size.x + next.x] < level - 1:
							inside = false
				if inside:
					depth[y * map.size.x + x] = level
					changed = true
		if not changed:
			break
	return depth


func _draw_roads() -> void:
	for road in battle.map.roads:
		var points := PackedVector2Array()
		for point in road:
			points.append(to_screen(point))
		draw_polyline(points, COLOR_ROAD, ROAD_WIDTH, true)
		# Round joints and ends, so a bend never shows a notch.
		for point in points:
			draw_circle(point, ROAD_WIDTH / 2.0, COLOR_ROAD)


## The grid is only hinted at: a small cross where squares meet and names along the edges.
func _draw_grid() -> void:
	var square := BattleMap.SQUARE_CELLS * CELL
	var columns := ceili(battle.map.size.x / float(BattleMap.SQUARE_CELLS))
	var rows := ceili(battle.map.size.y / float(BattleMap.SQUARE_CELLS))
	for column in range(1, columns):
		for row in range(1, rows):
			var at := Vector2(column, row) * square
			draw_line(at + Vector2(-4, 0), at + Vector2(4, 0), Color(COLOR_FAINT, 0.7), 1.0)
			draw_line(at + Vector2(0, -4), at + Vector2(0, 4), Color(COLOR_FAINT, 0.7), 1.0)
	for column in columns:
		draw_string(_font, Vector2(column * square, 14), BattleMap.SQUARE_LETTERS[column],
				HORIZONTAL_ALIGNMENT_CENTER, square, 11, COLOR_FAINT)
	for row in rows:
		draw_string(_font, Vector2(6, row * square + square / 2.0 + 4.0), str(row + 1),
				HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_FAINT)


# --- Objectives -------------------------------------------------------------

func _draw_objective(objective: BattleMap.Objective) -> void:
	var centre := to_screen(BattleMap.cell_centre(objective.cell))
	var radius := battle.rules.capture_radius * CELL
	var owner := battle.owners[objective.index]
	var color := COLOR_NEUTRAL
	if owner == BattleUnit.Side.PLAYER:
		color = COLOR_OWN
	elif owner == BattleUnit.Side.ENEMY:
		color = COLOR_ENEMY
	draw_circle(centre, radius, Color(color, 0.1))
	draw_arc(centre, radius, 0.0, TAU, 64, color, 3.0, true)

	var progress := battle.capture_progress[objective.index]
	if progress > 0.0:
		var taker := COLOR_OWN if battle.capture_side[objective.index] == BattleUnit.Side.PLAYER else COLOR_ENEMY
		draw_arc(centre, radius + 6.0, -PI / 2.0, -PI / 2.0 + TAU * progress, 64, taker, 5.0, true)
	_text(centre + Vector2(0, radius + 20.0), objective.title, 13, COLOR_INK, true)


# --- Units ------------------------------------------------------------------

## Circle for riflemen, triangle for scouts, square for carriers.
func _draw_shape(kind: int, centre: Vector2, radius: float, color: Color) -> void:
	match kind:
		UnitKind.Type.SCOUT:
			var points := PackedVector2Array()
			for i in 3:
				points.append(centre + Vector2.from_angle(TAU * i / 3.0 - PI / 2.0) * radius * 1.25)
			draw_colored_polygon(points, color)
		UnitKind.Type.APC:
			var side := radius * 1.75
			draw_rect(Rect2(centre - Vector2(side, side) / 2.0, Vector2(side, side)), color)
		_:
			draw_circle(centre, radius, color, true, -1.0, true)


func _draw_unit(unit: BattleUnit) -> void:
	var centre := to_screen(shown_position(unit))
	var selected := unit.id == selected_unit
	# Under fire: a red ring that beats, the way a crowded station warns in a metro map.
	if battle.time - unit.hit_at < 0.8:
		var beat := 0.5 + 0.5 * sin(battle.time * 14.0)
		draw_arc(centre, RING_RADIUS + 5.0 + beat * 2.0, 0.0, TAU, 48, Color(COLOR_ENEMY, 0.85), 3.0, true)

	# Strength: a ring around the shape that empties as the unit takes losses.
	var share := float(unit.strength) / unit.max_strength()
	draw_arc(centre, RING_RADIUS, 0.0, TAU, 48, Color(COLOR_INK, 0.1), 3.0, true)
	draw_arc(centre, RING_RADIUS, -PI / 2.0, -PI / 2.0 + TAU * share, 48, COLOR_OWN, 3.0, true)

	if selected:
		_draw_shape(unit.kind, centre, SHAPE_RADIUS + 3.0, COLOR_INK)
	_draw_shape(unit.kind, centre, SHAPE_RADIUS, COLOR_OWN)
	if unit.passenger >= 0:
		draw_circle(centre, 4.0, COLOR_LAND, true, -1.0, true)

	var title := unit.call_sign
	if unit.passenger >= 0:
		title += " + " + battle.units[unit.passenger].call_sign
	_text(centre + Vector2(0, RING_RADIUS + 16.0), title, 12, COLOR_INK, selected)


func _draw_fire(unit: BattleUnit) -> void:
	if unit.target < 0 or not battle.contacts.has(unit.target):
		return
	# Tracers flicker instead of drawing a steady line.
	if int(battle.time * 10.0) % 3 == 0:
		return
	var from := to_screen(shown_position(unit))
	var to := to_screen(battle.contacts[unit.target].position)
	draw_dashed_line(from, to, Color(COLOR_INK, 0.55), 2.0, 5.0)


## The way a unit is going, drawn like a metro line: bold for the selected unit.
func _draw_route(unit: BattleUnit) -> void:
	if not unit.is_moving():
		return
	var points := PackedVector2Array([to_screen(unit.position)])
	for i in range(unit.path_index, unit.path.size()):
		points.append(to_screen(unit.path[i]))
	if points.size() < 2:
		return
	var selected := unit.id == selected_unit
	var color := COLOR_OWN if selected else Color(COLOR_OWN, 0.35)
	var width := 4.0 if selected else 2.5
	draw_polyline(points, color, width, true)
	var end := points[points.size() - 1]
	draw_circle(end, width + 2.0, color, true, -1.0, true)
	draw_circle(end, width - 0.5, COLOR_LAND, true, -1.0, true)


# --- Enemy contacts ---------------------------------------------------------

func _draw_contact(contact: Battle.Contact) -> void:
	var centre := to_screen(contact.position)
	var age := battle.time - contact.last_seen
	var alpha := 1.0
	if not contact.visible:
		alpha = lerpf(0.6, 0.15, clampf(age / battle.rules.contact_fade, 0.0, 1.0))
	var color := Color(COLOR_ENEMY, alpha)
	# How unsure the position is: a pale disc the enemy is somewhere inside.
	if contact.error > 0.8:
		draw_circle(centre, contact.error * CELL, Color(COLOR_ENEMY, 0.1 * alpha), true, -1.0, true)
	if contact.kind < 0:
		draw_arc(centre, CONTACT_RADIUS, 0.0, TAU, 32, color, 3.0, true)
	else:
		_draw_shape(contact.kind, centre, CONTACT_RADIUS, color)
	if not contact.visible:
		_text(centre + Vector2(0, CONTACT_RADIUS + 15.0), BattleText.clock(age), 11, color, false)


# --- Artillery --------------------------------------------------------------

func _draw_strike(strike: Battle.Strike) -> void:
	var centre := to_screen(strike.target)
	var left := strike.lands_at - battle.time
	var radius := (battle.rules.strike_radius + battle.rules.strike_scatter) * CELL
	draw_circle(centre, radius, Color(COLOR_STRIKE, 0.12), true, -1.0, true)
	# The ring fills clockwise as the shells come in.
	var done := 1.0 - clampf(left / battle.rules.strike_delay, 0.0, 1.0)
	draw_arc(centre, radius, 0.0, TAU, 64, Color(COLOR_STRIKE, 0.35), 3.0, true)
	draw_arc(centre, radius, -PI / 2.0, -PI / 2.0 + TAU * done, 64, COLOR_STRIKE, 4.0, true)
	draw_circle(centre, 3.5, COLOR_STRIKE, true, -1.0, true)


func _draw_impacts() -> void:
	for i in range(battle.events.size() - 1, -1, -1):
		var event := battle.events[i]
		var age: float = battle.time - event.time
		if age > 1.5:
			break
		if event.kind != &"strike_landed":
			continue
		var centre := to_screen(event.position)
		var grow := age / 1.5
		var radius := battle.rules.strike_radius * CELL * (0.6 + 0.4 * grow)
		draw_circle(centre, radius, Color(COLOR_STRIKE, 0.6 * (1.0 - grow)), true, -1.0, true)


func _draw_strike_cursor() -> void:
	var centre := get_local_mouse_position()
	var radius := (battle.rules.strike_radius + battle.rules.strike_scatter) * CELL
	draw_circle(centre, battle.rules.strike_radius * CELL, Color(COLOR_STRIKE, 0.18), true, -1.0, true)
	draw_arc(centre, radius, 0.0, TAU, 64, COLOR_STRIKE, 3.0, true)
	draw_circle(centre, 3.5, COLOR_STRIKE, true, -1.0, true)


## Centred text with a soft halo of the land colour, so it reads over roads and shapes.
func _text(at: Vector2, text: String, font_size: int, color: Color, strong: bool) -> void:
	var width := _font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var origin := at + Vector2(-width / 2.0, 0)
	var halo := Color(COLOR_LAND, 0.85 * color.a)
	draw_string_outline(_font, origin, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 4, halo)
	draw_string(_font, origin, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
	if strong:
		draw_string(_font, origin + Vector2(0.5, 0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
