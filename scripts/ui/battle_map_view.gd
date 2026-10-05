class_name BattleMapView
extends Control
## Draws the mission as a topographic map: terrain, objectives, own units and enemy
## contacts. Enemy units themselves are never read here, only Battle.contacts.

signal map_clicked(position: Vector2, button: MouseButton)

const CELL := 16.0

const COLOR_FIELD := Color("dfe3c8")
const COLOR_FOREST := Color("b3cd9c")
const COLOR_TREE := Color("86a873")
const COLOR_HILL := Color("e6d6ad")
const COLOR_CONTOUR := Color("b08a52")
const COLOR_WATER := Color("a9cbe6")
const COLOR_SHORE := Color("7ea6c9")
const COLOR_TOWN := Color("d8d2c8")
const COLOR_BUILDING := Color("8c8882")
const COLOR_ROAD := Color("7d6c58")
const COLOR_BRIDGE := Color("55524e")
const COLOR_GRID := Color(0, 0, 0, 0.13)
const COLOR_INK := Color("23282e")
const COLOR_OWN := Color("2f6fb5")
const COLOR_OWN_FILL := Color("9cc4ee")
const COLOR_ENEMY := Color("c0392b")
const COLOR_ENEMY_FILL := Color("f0a9a0")
const COLOR_NEUTRAL := Color("6b7075")
const COLOR_SELECTED := Color("f2c230")

const SYMBOL_SIZE := Vector2(28, 18)
const CONTACT_RADIUS := 11.0
const PICK_RADIUS := 16.0

var battle: Battle
var selected_unit := -1
## While true the cursor shows where an artillery strike would land.
var strike_mode := false

var _terrain: ImageTexture
var _font: Font


func _ready() -> void:
	_font = get_theme_default_font()
	mouse_filter = Control.MOUSE_FILTER_STOP


func set_battle(new_battle: Battle) -> void:
	battle = new_battle
	_terrain = ImageTexture.create_from_image(_paint_terrain())
	custom_minimum_size = Vector2(battle.map.size) * CELL
	queue_redraw()


func to_map(point: Vector2) -> Vector2:
	return point / CELL


func to_screen(position: Vector2) -> Vector2:
	return position * CELL


## Where the unit's symbol is drawn, in map coordinates. Units standing together are
## spread sideways so every symbol and call sign stays readable and clickable.
func shown_position(unit: BattleUnit) -> Vector2:
	var shift := 0
	for other in battle.units:
		if other.id >= unit.id:
			break
		if other.side == unit.side and other.is_on_map() and other.position.distance_to(unit.position) < 1.2:
			shift += 1
	return unit.position + Vector2(shift * (SYMBOL_SIZE.x + 6.0) / CELL, 0.0)


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
	draw_texture(_terrain, Vector2.ZERO)
	_draw_grid_labels()
	for objective in battle.map.objectives:
		_draw_objective(objective)
	_draw_selected_path()
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

func _paint_terrain() -> Image:
	var map := battle.map
	var cell := int(CELL)
	var image := Image.create(map.size.x * cell, map.size.y * cell, false, Image.FORMAT_RGB8)
	image.fill(COLOR_FIELD)
	var depth := _hill_depth()
	var noise := RandomNumberGenerator.new()
	noise.seed = 20261006

	for y in map.size.y:
		for x in map.size.x:
			var at := Vector2i(x, y)
			var origin := at * cell
			var type := map.get_terrain(at)
			match type:
				Terrain.Type.FOREST:
					image.fill_rect(Rect2i(origin, Vector2i(cell, cell)), COLOR_FOREST)
					for i in 3:
						var tree := origin + Vector2i(noise.randi_range(1, cell - 4), noise.randi_range(1, cell - 4))
						image.fill_rect(Rect2i(tree, Vector2i(3, 3)), COLOR_TREE)
				Terrain.Type.HILL:
					var shade := COLOR_HILL.darkened(0.05 * (depth[y * map.size.x + x] - 1))
					image.fill_rect(Rect2i(origin, Vector2i(cell, cell)), shade)
				Terrain.Type.WATER, Terrain.Type.BRIDGE:
					image.fill_rect(Rect2i(origin, Vector2i(cell, cell)), COLOR_WATER)
				Terrain.Type.TOWN:
					image.fill_rect(Rect2i(origin, Vector2i(cell, cell)), COLOR_TOWN)
					var house := origin + Vector2i(noise.randi_range(2, 4), noise.randi_range(2, 5))
					image.fill_rect(Rect2i(house, Vector2i(noise.randi_range(7, 10), noise.randi_range(6, 8))), COLOR_BUILDING)

	# Contour lines and shores run along cell edges where the height or terrain changes.
	for y in map.size.y:
		for x in map.size.x:
			var at := Vector2i(x, y)
			for step: Vector2i in [Vector2i.RIGHT, Vector2i.DOWN]:
				var next := at + step
				if not map.contains(next):
					continue
				var edge := Rect2i(next * cell, Vector2i(1, cell) if step.x == 1 else Vector2i(cell, 1))
				if depth[y * map.size.x + x] != depth[next.y * map.size.x + next.x]:
					image.fill_rect(edge, COLOR_CONTOUR)
				elif _is_wet(at) != _is_wet(next):
					image.fill_rect(edge, COLOR_SHORE)

	for y in map.size.y:
		for x in map.size.x:
			var at := Vector2i(x, y)
			var type := map.get_terrain(at)
			if type == Terrain.Type.ROAD or type == Terrain.Type.BRIDGE:
				_paint_road_cell(image, at, type == Terrain.Type.BRIDGE)

	var square := BattleMap.SQUARE_CELLS * cell
	for x in range(square, image.get_width(), square):
		_blend_rect(image, Rect2i(x, 0, 1, image.get_height()), COLOR_GRID)
	for y in range(square, image.get_height(), square):
		_blend_rect(image, Rect2i(0, y, image.get_width(), 1), COLOR_GRID)
	return image


func _paint_road_cell(image: Image, at: Vector2i, bridge: bool) -> void:
	var cell := int(CELL)
	var width := 6 if bridge else 4
	var color := COLOR_BRIDGE if bridge else COLOR_ROAD
	var centre := at * cell + Vector2i(cell / 2, cell / 2)
	image.fill_rect(Rect2i(centre - Vector2i(width / 2, width / 2), Vector2i(width, width)), color)
	for step: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
		var type := battle.map.get_terrain(at + step)
		var joins := type == Terrain.Type.ROAD or type == Terrain.Type.BRIDGE
		# Roads run off the edge of the map instead of ending short of it.
		if not joins and battle.map.contains(at + step):
			continue
		var arm := Rect2i(centre - Vector2i(width / 2, width / 2), Vector2i(width, width))
		if step.x != 0:
			arm.size.x = cell / 2
			arm.position.x = centre.x if step.x > 0 else centre.x - cell / 2
		else:
			arm.size.y = cell / 2
			arm.position.y = centre.y if step.y > 0 else centre.y - cell / 2
		image.fill_rect(arm, color)


func _blend_rect(image: Image, rect: Rect2i, color: Color) -> void:
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			image.set_pixel(x, y, image.get_pixel(x, y).blend(color))


func _is_wet(at: Vector2i) -> bool:
	var type := battle.map.get_terrain(at)
	return type == Terrain.Type.WATER or type == Terrain.Type.BRIDGE


## For every cell: 0 off a hill, otherwise how many cells deep inside the hill it lies.
func _hill_depth() -> PackedInt32Array:
	var map := battle.map
	var depth := PackedInt32Array()
	depth.resize(map.size.x * map.size.y)
	for level in range(1, 6):
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


func _draw_grid_labels() -> void:
	var square := BattleMap.SQUARE_CELLS * CELL
	for column in ceili(battle.map.size.x / float(BattleMap.SQUARE_CELLS)):
		for row in ceili(battle.map.size.y / float(BattleMap.SQUARE_CELLS)):
			var label := "%s%d" % [BattleMap.SQUARE_LETTERS[column], row + 1]
			draw_string(_font, Vector2(column * square + 4, row * square + 13), label,
					HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0, 0, 0, 0.38))


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
	draw_circle(centre, radius, Color(color, 0.12))
	draw_arc(centre, radius, 0.0, TAU, 48, color, 2.0, true)

	var progress := battle.capture_progress[objective.index]
	if progress > 0.0:
		var taker := COLOR_OWN if battle.capture_side[objective.index] == BattleUnit.Side.PLAYER else COLOR_ENEMY
		draw_arc(centre, radius + 4.0, -PI / 2.0, -PI / 2.0 + TAU * progress, 48, taker, 4.0, true)

	var flag := centre + Vector2(0, -radius - 6.0)
	draw_line(flag, flag + Vector2(0, -16), COLOR_INK, 2.0)
	draw_colored_polygon(
		PackedVector2Array([flag + Vector2(0, -16), flag + Vector2(12, -12), flag + Vector2(0, -8)]),
		color
	)
	_label(centre + Vector2(0, radius + 16.0), objective.title, 13, COLOR_INK)


# --- Units ------------------------------------------------------------------

func _draw_unit(unit: BattleUnit) -> void:
	var centre := to_screen(shown_position(unit))
	var rect := Rect2(centre - SYMBOL_SIZE / 2.0, SYMBOL_SIZE)
	if battle.time - unit.hit_at < 0.6:
		draw_arc(centre, 22.0, 0.0, TAU, 32, COLOR_ENEMY, 3.0, true)
	draw_rect(rect, COLOR_OWN_FILL)
	draw_rect(rect, COLOR_SELECTED if unit.id == selected_unit else COLOR_OWN, false, 3.0 if unit.id == selected_unit else 2.0)
	match unit.kind:
		UnitKind.Type.RIFLE:
			draw_line(rect.position, rect.end, COLOR_OWN, 1.5, true)
			draw_line(Vector2(rect.position.x, rect.end.y), Vector2(rect.end.x, rect.position.y), COLOR_OWN, 1.5, true)
		UnitKind.Type.SCOUT:
			draw_line(Vector2(rect.position.x, rect.end.y), Vector2(rect.end.x, rect.position.y), COLOR_OWN, 1.5, true)
		UnitKind.Type.APC:
			draw_set_transform(centre, 0.0, Vector2(1.0, 0.55))
			draw_arc(Vector2.ZERO, 10.0, 0.0, TAU, 24, COLOR_OWN, 1.5 / 0.55, true)
			draw_set_transform(Vector2.ZERO)

	# Strength: one pip per man or hull point, the lost ones hollow.
	var pips := unit.max_strength()
	var pip_width := minf(4.0, (SYMBOL_SIZE.x + 8.0) / pips)
	var start := centre + Vector2(-pip_width * pips / 2.0, SYMBOL_SIZE.y / 2.0 + 3.0)
	for i in pips:
		var pip := Rect2(start + Vector2(i * pip_width, 0), Vector2(pip_width - 1.0, 4))
		draw_rect(pip, COLOR_OWN if i < unit.strength else Color(COLOR_INK, 0.25))

	var title := unit.call_sign
	if unit.passenger >= 0:
		title += " + " + battle.units[unit.passenger].call_sign
	_label(centre + Vector2(0, SYMBOL_SIZE.y / 2.0 + 21.0), title, 12, COLOR_INK)


func _draw_fire(unit: BattleUnit) -> void:
	if unit.target < 0 or not battle.contacts.has(unit.target):
		return
	# Tracers flicker instead of drawing a steady line.
	if int(battle.time * 10.0) % 3 == 0:
		return
	var from := to_screen(shown_position(unit))
	var to := to_screen(battle.contacts[unit.target].position)
	draw_dashed_line(from, to, Color(COLOR_OWN, 0.8), 1.5, 6.0)


func _draw_selected_path() -> void:
	var unit := battle.get_unit(selected_unit)
	if unit == null or not unit.is_on_map() or not unit.is_moving():
		return
	var points := PackedVector2Array([to_screen(unit.position)])
	for i in range(unit.path_index, unit.path.size()):
		points.append(to_screen(unit.path[i]))
	if points.size() >= 2:
		draw_polyline(points, Color(COLOR_OWN, 0.75), 2.0, true)
		draw_circle(points[points.size() - 1], 4.0, COLOR_OWN)


# --- Enemy contacts ---------------------------------------------------------

func _draw_contact(contact: Battle.Contact) -> void:
	var centre := to_screen(contact.position)
	var age := battle.time - contact.last_seen
	var alpha := 1.0
	if not contact.visible:
		alpha = lerpf(0.75, 0.2, clampf(age / battle.rules.contact_fade, 0.0, 1.0))
	if contact.error > 0.8:
		draw_arc(centre, contact.error * CELL, 0.0, TAU, 32, Color(COLOR_ENEMY, alpha * 0.6), 1.0, true)
	var diamond := PackedVector2Array([
		centre + Vector2(0, -CONTACT_RADIUS), centre + Vector2(CONTACT_RADIUS, 0),
		centre + Vector2(0, CONTACT_RADIUS), centre + Vector2(-CONTACT_RADIUS, 0),
	])
	draw_colored_polygon(diamond, Color(COLOR_ENEMY_FILL, alpha))
	diamond.append(diamond[0])
	draw_polyline(diamond, Color(COLOR_ENEMY, alpha), 2.0, true)
	var mark := "?"
	match contact.kind:
		UnitKind.Type.RIFLE:
			mark = "П"
		UnitKind.Type.SCOUT:
			mark = "Р"
		UnitKind.Type.APC:
			mark = "Б"
	draw_string(_font, centre + Vector2(-10, 5), mark, HORIZONTAL_ALIGNMENT_CENTER, 20, 13, Color(COLOR_INK, alpha))
	if not contact.visible:
		_label(centre + Vector2(0, CONTACT_RADIUS + 13.0), BattleText.clock(age), 11, Color(COLOR_ENEMY, alpha))


# --- Artillery --------------------------------------------------------------

func _draw_strike(strike: Battle.Strike) -> void:
	var centre := to_screen(strike.target)
	var left := strike.lands_at - battle.time
	var radius := (battle.rules.strike_radius + battle.rules.strike_scatter) * CELL
	draw_arc(centre, radius, 0.0, TAU, 40, COLOR_INK, 1.5, true)
	draw_line(centre + Vector2(-8, 0), centre + Vector2(8, 0), COLOR_INK, 1.5)
	draw_line(centre + Vector2(0, -8), centre + Vector2(0, 8), COLOR_INK, 1.5)
	_label(centre + Vector2(0, -radius - 4.0), "удар через %d с" % ceili(left), 12, COLOR_INK)


func _draw_impacts() -> void:
	for i in range(battle.events.size() - 1, -1, -1):
		var event := battle.events[i]
		var age: float = battle.time - event.time
		if age > 1.5:
			break
		if event.kind != &"strike_landed":
			continue
		var centre := to_screen(event.position)
		var radius := battle.rules.strike_radius * CELL
		draw_circle(centre, radius, Color(1.0, 0.55, 0.1, 0.5 * (1.0 - age / 1.5)))
		draw_arc(centre, radius, 0.0, TAU, 40, Color(0.75, 0.25, 0.05), 2.0, true)


func _draw_strike_cursor() -> void:
	var centre := get_local_mouse_position()
	var radius := (battle.rules.strike_radius + battle.rules.strike_scatter) * CELL
	draw_arc(centre, radius, 0.0, TAU, 40, COLOR_ENEMY, 2.0, true)
	draw_arc(centre, battle.rules.strike_radius * CELL, 0.0, TAU, 40, Color(COLOR_ENEMY, 0.5), 1.0, true)


## Centred text on a pale plate so it stays readable over any terrain.
func _label(at: Vector2, text: String, font_size: int, color: Color) -> void:
	var width := _font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var plate := Rect2(at + Vector2(-width / 2.0 - 3.0, -font_size), Vector2(width + 6.0, font_size + 4.0))
	draw_rect(plate, Color(1, 1, 1, 0.6 * color.a))
	draw_string(_font, at + Vector2(-width / 2.0, 0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
