class_name ZoneManager
extends GridPlanningLayer

signal zones_changed

const ERASE_TOOL := &"erase"
const CARDINAL_DIRECTIONS: Array[Vector2i] = [
	Vector2i.LEFT,
	Vector2i.RIGHT,
	Vector2i.UP,
	Vector2i.DOWN,
]

var _cells: Dictionary[Vector2i, StringName] = {}
var _boundary_provider := Callable()
var _areas_cache: Array[Dictionary] = []
var _area_index_by_cell: Dictionary[Vector2i, int] = {}
var _areas_dirty := true


func set_active_tool(tool_id: StringName) -> void:
	if tool_id != ERASE_TOOL and not ZoneCatalog.has_zone(tool_id):
		return
	_activate_tool(tool_id)


func set_boundary_provider(provider: Callable) -> void:
	_boundary_provider = provider
	_invalidate_areas()
	queue_redraw()


func refresh_boundaries(
	_cell: Vector2i = Vector2i.ZERO,
	_object_id: StringName = &""
) -> void:
	_invalidate_areas()
	queue_redraw()


func paint_rect(from: Vector2i, to: Vector2i, zone_id: StringName) -> void:
	if not ZoneCatalog.has_zone(zone_id):
		return
	for cell in _get_cells_in_rect(from, to):
		if _is_cell_inside_map(cell):
			_cells[cell] = zone_id
	_invalidate_areas()
	zones_changed.emit()
	queue_redraw()


func erase_rect(from: Vector2i, to: Vector2i) -> void:
	for cell in _get_cells_in_rect(from, to):
		_cells.erase(cell)
	_invalidate_areas()
	zones_changed.emit()
	queue_redraw()


func get_zone_at(cell: Vector2i) -> StringName:
	return _cells.get(cell, &"")


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
	var area := _get_area_at(cell)
	return not area.is_empty() and area["status"]["is_valid"]


func get_room_status_at(cell: Vector2i) -> Dictionary:
	var area := _get_area_at(cell)
	return {} if area.is_empty() else area["status"]


func get_room_info_at_world(world_position: Vector2) -> Dictionary:
	return get_room_info_at(_world_to_cell(world_position))


func get_room_info_at(cell: Vector2i) -> Dictionary:
	var area := _get_area_at(cell)
	if area.is_empty():
		return {}
	var area_cells: Array[Vector2i] = area["cells"]
	var status: Dictionary = area["status"]
	var missing: Array[String] = []
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


func _apply_planning_drag() -> void:
	if _drag_tool == ERASE_TOOL:
		erase_rect(_drag_start, _drag_current)
	else:
		paint_rect(_drag_start, _drag_current, _drag_tool)


func _draw() -> void:
	for area in _get_areas():
		_draw_zone_area(
			area["cells"],
			ZoneCatalog.get_color(area["zone_id"]),
			area["status"]
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


func _draw_zone_area(
	cells: Array[Vector2i],
	color: Color,
	status: Dictionary
) -> void:
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
	if _areas_dirty:
		_rebuild_areas_cache()
	return _areas_cache


func _get_area_at(cell: Vector2i) -> Dictionary:
	if _areas_dirty:
		_rebuild_areas_cache()
	if not _area_index_by_cell.has(cell):
		return {}
	return _areas_cache[_area_index_by_cell[cell]]


func _rebuild_areas_cache() -> void:
	_areas_cache.clear()
	_area_index_by_cell.clear()
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
		var area_index := _areas_cache.size()
		var area := {
			"zone_id": zone_id,
			"cells": area_cells,
			"status": _get_room_status(area_cells),
		}
		_areas_cache.append(area)
		for cell in area_cells:
			_area_index_by_cell[cell] = area_index
	_areas_dirty = false


func _invalidate_areas() -> void:
	_areas_dirty = true


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
		"is_enclosed": is_enclosed,
		"has_door": has_door,
		"open_edges": open_edges,
		"is_valid": is_enclosed and has_door,
	}


func _get_boundary_at(cell: Vector2i) -> StringName:
	if not _boundary_provider.is_valid() or not _is_cell_inside_map(cell):
		return &""
	return _boundary_provider.call(cell)


func _get_cells_in_rect(from: Vector2i, to: Vector2i) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	var minimum := Vector2i(mini(from.x, to.x), mini(from.y, to.y))
	var maximum := Vector2i(maxi(from.x, to.x), maxi(from.y, to.y))
	for y in range(minimum.y, maximum.y + 1):
		for x in range(minimum.x, maximum.x + 1):
			result.append(Vector2i(x, y))
	return result
