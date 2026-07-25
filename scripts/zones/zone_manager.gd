class_name ZoneManager
extends Node2D

signal active_tool_changed(tool_id: StringName)
signal zones_changed

const TILE_SIZE := 32
const MAP_SIZE := Vector2i(64, 64)
const ERASE_TOOL := &"erase"

var active_tool: StringName = &""
var _cells: Dictionary[Vector2i, StringName] = {}
var _dragging := false
var _drag_start := Vector2i.ZERO
var _drag_current := Vector2i.ZERO
var _drag_tool: StringName = &""


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
	active_tool_changed.emit(active_tool)
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


func get_zone_count(zone_id: StringName) -> int:
	var count := 0
	for cell_zone: StringName in _cells.values():
		if cell_zone == zone_id:
			count += 1
	return count


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.is_pressed() and event.keycode == KEY_ESCAPE:
		if active_tool.is_empty():
			return
		clear_active_tool()
		get_viewport().set_input_as_handled()
		return

	if active_tool.is_empty():
		return

	if event is InputEventMouseButton:
		var is_paint_button: bool = event.button_index == MOUSE_BUTTON_LEFT
		var is_erase_button: bool = event.button_index == MOUSE_BUTTON_RIGHT
		if not is_paint_button and not is_erase_button:
			return

		if event.pressed:
			_dragging = true
			_drag_start = _world_to_cell(get_global_mouse_position())
			_drag_current = _drag_start
			_drag_tool = ERASE_TOOL if is_erase_button else active_tool
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
	for cell: Vector2i in _cells:
		var zone_id: StringName = _cells[cell]
		_draw_zone_cell(cell, ZoneCatalog.get_color(zone_id), false)

	if not _dragging:
		return

	var preview_color := Color(0.75, 0.18, 0.18) if _drag_tool == ERASE_TOOL else ZoneCatalog.get_color(_drag_tool)
	for cell in _get_cells_in_rect(_drag_start, _drag_current):
		if _is_cell_inside_map(cell):
			_draw_zone_cell(cell, preview_color, true)


func _draw_zone_cell(cell: Vector2i, color: Color, is_preview: bool) -> void:
	var rect := Rect2(Vector2(cell * TILE_SIZE), Vector2.ONE * TILE_SIZE)
	var fill := color
	fill.a = 0.28 if is_preview else 0.22
	var outline := color
	outline.a = 0.9 if is_preview else 0.65
	draw_rect(rect.grow(-1.0), fill, true)
	draw_rect(rect.grow(-1.0), outline, false, 2.0)


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
