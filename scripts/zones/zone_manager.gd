class_name ZoneManager
extends Node2D

signal active_tool_changed(tool_id: StringName)
signal zones_changed

const TILE_SIZE := 32
const MAP_SIZE := Vector2i(64, 64)
const ERASE_TOOL := &"erase"
const CARDINAL_DIRECTIONS: Array[Vector2i] = [
	Vector2i.LEFT,
	Vector2i.RIGHT,
	Vector2i.UP,
	Vector2i.DOWN,
]

var active_tool: StringName = &""
var _cells: Dictionary[Vector2i, StringName] = {}
var _boundary_provider := Callable()
var _dragging := false
var _drag_start := Vector2i.ZERO
var _drag_current := Vector2i.ZERO
var _drag_tool: StringName = &""
var _hover_cell := Vector2i.ZERO
var _hover_visible := false


func _process(_delta: float) -> void:
	var next_hover_visible := (
		not active_tool.is_empty()
		and get_viewport().gui_get_hovered_control() == null
	)
	var next_hover_cell := _world_to_cell(get_global_mouse_position())
	if (
		next_hover_visible != _hover_visible
		or next_hover_cell != _hover_cell
	):
		_hover_visible = next_hover_visible
		_hover_cell = next_hover_cell
		queue_redraw()


func set_active_tool(tool_id: StringName) -> void:
	if tool_id != ERASE_TOOL and not ZoneCatalog.has_zone(tool_id):
		return
	active_tool = tool_id
	_cancel_drag()
	active_tool_changed.emit(active_tool)
	queue_redraw()


func clear_active_tool() -> void:
	active_tool = &""
	_cancel_drag()
	_hover_visible = false
	active_tool_changed.emit(active_tool)
	queue_redraw()


func set_boundary_provider(provider: Callable) -> void:
	_boundary_provider = provider
	queue_redraw()


func refresh_boundaries(
	_cell: Vector2i = Vector2i.ZERO,
	_object_id: StringName = &""
) -> void:
	queue_redraw()


func paint_rect(from: Vector2i, to: Vector2i, zone_id: StringName) -> void:
	if not ZoneCatalog.has_zone(zone_id):
		return
	for cell in _get_cells_in_rect(from, to):
		if _is_cell_inside_map(cell):
			_cells[cell] = zone_id
	zones_changed.emit()
	queue_redraw()


func erase_rect(from: Vector2i, to: Vector2i) -> void:
	for cell in _get_cells_in_rect(from, to):
		_cells.erase(cell)
	zones_changed.emit()
	queue_redraw()


func get_zone_at(cell: Vector2i) -> StringName:
	return _cells.get(cell, &"")


func is_hover_preview_visible() -> bool:
	return _hover_visible and _is_cell_inside_map(_hover_cell)


func get_zone_count(zone_id: StringName) -> int:
	var count := 0
	for cell_zone: StringName in _cells.values():
		if cell_zone == zone_id:
			count += 1
	return count


func get_area_count(zone_id: StringName) -> int:
	var count := 0
	for area in _get_areas():
		if area["zone_id"] == zone_id:
			count += 1
	return count


func is_room_valid_at(cell: Vector2i) -> bool:
	if not _cells.has(cell):
		return false
	for area in _get_areas():
		var area_cells: Array[Vector2i] = area["cells"]
		if cell in area_cells:
			return _get_room_status(area_cells)["is_valid"]
	return false


func get_room_status_at(cell: Vector2i) -> Dictionary:
	if not _cells.has(cell):
		return {}
	for area in _get_areas():
		var area_cells: Array[Vector2i] = area["cells"]
		if cell in area_cells:
			return _get_room_status(area_cells)
	return {}


func get_room_info_at_world(world_position: Vector2) -> Dictionary:
	return get_room_info_at(_world_to_cell(world_position))


func get_room_info_at(cell: Vector2i) -> Dictionary:
	if not _cells.has(cell):
		return {}
	for area in _get_areas():
		var area_cells: Array[Vector2i] = area["cells"]
		if cell not in area_cells:
			continue
		var status := _get_room_status(area_cells)
		var missing: Array[String] = []
		if not status["is_connected"]:
			missing.append("Зона разделена")
		if not status["is_enclosed"]:
			missing.append(
				"Не замкнут периметр (%d открытых сторон)"
				% status["open_edges"]
			)
		if not status["has_door"]:
			missing.append("Нет двери")
		return {
			"zone_id": area["zone_id"],
			"label": ZoneCatalog.get_label(area["zone_id"]),
			"cell_count": area_cells.size(),
			"status": status,
			"missing": missing,
		}
	return {}


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.is_pressed() and event.keycode == KEY_ESCAPE:
		if active_tool.is_empty():
			return
		clear_active_tool()
		get_viewport().set_input_as_handled()
		return

	if (
		event is InputEventMouseButton
		and event.button_index == MOUSE_BUTTON_RIGHT
		and event.pressed
	):
		if active_tool.is_empty():
			return
		clear_active_tool()
		get_viewport().set_input_as_handled()
		return

	if active_tool.is_empty():
		return

	if event is InputEventMouseButton:
		var is_paint_button: bool = event.button_index == MOUSE_BUTTON_LEFT
		if not is_paint_button:
			return

		if event.pressed:
			_dragging = true
			_drag_start = _world_to_cell(get_global_mouse_position())
			_drag_current = _drag_start
			_drag_tool = active_tool
		else:
			if not _dragging:
				return
			_drag_current = _world_to_cell(get_global_mouse_position())
			if _drag_tool == ERASE_TOOL:
				erase_rect(_drag_start, _drag_current)
			else:
				paint_rect(_drag_start, _drag_current, _drag_tool)
			_cancel_drag()
		queue_redraw()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and _dragging:
		_drag_current = _world_to_cell(get_global_mouse_position())
		queue_redraw()
		get_viewport().set_input_as_handled()


func _draw() -> void:
	for area in _get_areas():
		_draw_zone_area(
			area["cells"],
			ZoneCatalog.get_color(area["zone_id"])
		)

	if not _dragging:
		if is_hover_preview_visible():
			var hover_color := (
				Color(0.75, 0.18, 0.18)
				if active_tool == ERASE_TOOL
				else ZoneCatalog.get_color(active_tool)
			)
			_draw_zone_hover(_hover_cell, hover_color)
		return

	var preview_color := Color(0.75, 0.18, 0.18) if _drag_tool == ERASE_TOOL else ZoneCatalog.get_color(_drag_tool)
	_draw_zone_preview(preview_color)


func _draw_zone_hover(cell: Vector2i, color: Color) -> void:
	var rect := Rect2(
		Vector2(cell * TILE_SIZE),
		Vector2.ONE * TILE_SIZE
	)
	var fill := color
	fill.a = 0.32
	var outline := color.lightened(0.2)
	outline.a = 0.95
	draw_rect(rect.grow(-1.0), fill, true)
	draw_rect(rect.grow(-1.0), outline, false, 3.0)


func _draw_zone_area(cells: Array[Vector2i], color: Color) -> void:
	var status := _get_room_status(cells)
	var fill := color
	fill.a = 0.24
	if not status["is_valid"]:
		fill = fill.lerp(Color(0.75, 0.14, 0.12, 0.24), 0.35)
	for cell in cells:
		var rect := Rect2(
			Vector2(cell * TILE_SIZE),
			Vector2.ONE * TILE_SIZE
		)
		draw_rect(rect.grow(0.5), fill, true)

	var cell_set: Dictionary[Vector2i, bool] = {}
	for cell in cells:
		cell_set[cell] = true
	var outline := color if status["is_valid"] else Color("db5147")
	outline.a = 0.95 if not status["is_valid"] else 0.78
	for cell in cells:
		var origin := Vector2(cell * TILE_SIZE)
		if not cell_set.has(cell + Vector2i.UP):
			draw_line(origin, origin + Vector2(TILE_SIZE, 0), outline, 3.0)
		if not cell_set.has(cell + Vector2i.RIGHT):
			draw_line(
				origin + Vector2(TILE_SIZE, 0),
				origin + Vector2(TILE_SIZE, TILE_SIZE),
				outline,
				3.0
			)
		if not cell_set.has(cell + Vector2i.DOWN):
			draw_line(
				origin + Vector2(0, TILE_SIZE),
				origin + Vector2(TILE_SIZE, TILE_SIZE),
				outline,
				3.0
			)
		if not cell_set.has(cell + Vector2i.LEFT):
			draw_line(origin, origin + Vector2(0, TILE_SIZE), outline, 3.0)
	if not status["is_enclosed"]:
		_draw_room_warning(_get_area_center(cells))


func _draw_room_warning(center: Vector2) -> void:
	var points := PackedVector2Array([
		center + Vector2(0, -15),
		center + Vector2(15, 13),
		center + Vector2(-15, 13),
	])
	draw_colored_polygon(points, Color("c93632"))
	var outline := PackedVector2Array([points[0], points[1], points[2], points[0]])
	draw_polyline(outline, Color("ffd3c7"), 2.0)
	draw_string(
		ThemeDB.fallback_font,
		center + Vector2(-4, 9),
		"!",
		HORIZONTAL_ALIGNMENT_CENTER,
		8,
		20,
		Color.WHITE
	)


func _get_area_center(cells: Array[Vector2i]) -> Vector2:
	var average := Vector2.ZERO
	for cell in cells:
		average += Vector2(cell * TILE_SIZE) + Vector2.ONE * TILE_SIZE * 0.5
	average /= float(cells.size())
	var closest := average
	var closest_distance := INF
	for cell in cells:
		var cell_center := (
			Vector2(cell * TILE_SIZE)
			+ Vector2.ONE * TILE_SIZE * 0.5
		)
		var distance := cell_center.distance_squared_to(average)
		if distance < closest_distance:
			closest_distance = distance
			closest = cell_center
	return closest


func _draw_zone_preview(color: Color) -> void:
	var minimum := Vector2i(
		mini(_drag_start.x, _drag_current.x),
		mini(_drag_start.y, _drag_current.y)
	)
	var maximum := Vector2i(
		maxi(_drag_start.x, _drag_current.x),
		maxi(_drag_start.y, _drag_current.y)
	)
	minimum.x = clampi(minimum.x, 0, MAP_SIZE.x - 1)
	minimum.y = clampi(minimum.y, 0, MAP_SIZE.y - 1)
	maximum.x = clampi(maximum.x, 0, MAP_SIZE.x - 1)
	maximum.y = clampi(maximum.y, 0, MAP_SIZE.y - 1)
	var rect := Rect2(
		Vector2(minimum * TILE_SIZE),
		Vector2((maximum - minimum + Vector2i.ONE) * TILE_SIZE)
	)
	var fill := color
	fill.a = 0.3
	var outline := color
	outline.a = 0.95
	draw_rect(rect, fill, true)
	draw_rect(rect, outline, false, 3.0)


func _get_areas() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var visited: Dictionary[Vector2i, bool] = {}
	for start: Vector2i in _cells:
		if visited.has(start):
			continue
		var zone_id: StringName = _cells[start]
		var area_cells: Array[Vector2i] = []
		var frontier: Array[Vector2i] = [start]
		visited[start] = true
		while not frontier.is_empty():
			var cell: Vector2i = frontier.pop_back()
			area_cells.append(cell)
			for direction in CARDINAL_DIRECTIONS:
				var neighbor := cell + direction
				if (
					visited.has(neighbor)
					or _cells.get(neighbor, &"") != zone_id
				):
					continue
				visited[neighbor] = true
				frontier.append(neighbor)
		result.append({
			"zone_id": zone_id,
			"cells": area_cells,
		})
	return result


func _get_room_status(cells: Array[Vector2i]) -> Dictionary:
	var has_door := false
	var is_enclosed := _boundary_provider.is_valid()
	var open_edges := 0
	var cell_set: Dictionary[Vector2i, bool] = {}
	for cell in cells:
		cell_set[cell] = true
		if _get_boundary_at(cell) in [&"wall", &"door"]:
			is_enclosed = false

	for cell in cells:
		for direction in CARDINAL_DIRECTIONS:
			var neighbor := cell + direction
			if cell_set.has(neighbor):
				continue
			var boundary := _get_boundary_at(neighbor)
			if boundary == &"door":
				has_door = true
			elif boundary != &"wall":
				is_enclosed = false
				open_edges += 1

	return {
		"is_connected": true,
		"is_enclosed": is_enclosed,
		"has_door": has_door,
		"open_edges": open_edges,
		"is_valid": is_enclosed and has_door,
	}


func _get_boundary_at(cell: Vector2i) -> StringName:
	if not _boundary_provider.is_valid() or not _is_cell_inside_map(cell):
		return &""
	return _boundary_provider.call(cell)


func _world_to_cell(world_position: Vector2) -> Vector2i:
	return Vector2i(floori(world_position.x / TILE_SIZE), floori(world_position.y / TILE_SIZE))


func _get_cells_in_rect(from: Vector2i, to: Vector2i) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	var minimum := Vector2i(mini(from.x, to.x), mini(from.y, to.y))
	var maximum := Vector2i(maxi(from.x, to.x), maxi(from.y, to.y))
	for y in range(minimum.y, maximum.y + 1):
		for x in range(minimum.x, maximum.x + 1):
			result.append(Vector2i(x, y))
	return result


func _is_cell_inside_map(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < MAP_SIZE.x and cell.y < MAP_SIZE.y


func _cancel_drag() -> void:
	_dragging = false
	_drag_tool = &""
