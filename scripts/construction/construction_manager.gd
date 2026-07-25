class_name ConstructionManager
extends Node2D

signal active_tool_changed(tool_id: StringName)
signal blueprints_changed

const TILE_SIZE := 32
const MAP_SIZE := Vector2i(64, 64)
const ERASE_TOOL := &"erase_construction"

var active_tool: StringName = &""
var _blueprints: Dictionary[Vector2i, StringName] = {}
var _dragging := false
var _drag_start := Vector2i.ZERO
var _drag_current := Vector2i.ZERO
var _drag_tool: StringName = &""


func set_active_tool(tool_id: StringName) -> void:
	if tool_id != ERASE_TOOL and not ConstructionCatalog.has_tool(tool_id):
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


func place_blueprint(cell: Vector2i, object_id: StringName) -> void:
	if not _is_cell_inside_map(cell) or not ConstructionCatalog.has_tool(object_id):
		return
	_blueprints[cell] = object_id
	blueprints_changed.emit()
	queue_redraw()


func place_line(from: Vector2i, to: Vector2i, object_id: StringName) -> void:
	if not ConstructionCatalog.has_tool(object_id):
		return
	for cell in _get_orthogonal_line(from, to):
		if _is_cell_inside_map(cell):
			_blueprints[cell] = object_id
	blueprints_changed.emit()
	queue_redraw()


func erase_line(from: Vector2i, to: Vector2i) -> void:
	for cell in _get_orthogonal_line(from, to):
		_blueprints.erase(cell)
	blueprints_changed.emit()
	queue_redraw()


func get_blueprint_at(cell: Vector2i) -> StringName:
	return _blueprints.get(cell, &"")


func get_blueprint_count(object_id: StringName) -> int:
	var count := 0
	for blueprint_id: StringName in _blueprints.values():
		if blueprint_id == object_id:
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
		var is_place_button: bool = event.button_index == MOUSE_BUTTON_LEFT
		var is_erase_button: bool = event.button_index == MOUSE_BUTTON_RIGHT
		if not is_place_button and not is_erase_button:
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
			_apply_drag()
			_cancel_drag()
		queue_redraw()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and _dragging:
		_drag_current = _world_to_cell(get_global_mouse_position())
		queue_redraw()
		get_viewport().set_input_as_handled()


func _apply_drag() -> void:
	if _drag_tool == ERASE_TOOL:
		erase_line(_drag_start, _drag_current)
	elif ConstructionCatalog.get_placement(_drag_tool) == "single":
		place_blueprint(_drag_start, _drag_tool)
	else:
		place_line(_drag_start, _drag_current, _drag_tool)


func _draw() -> void:
	for cell: Vector2i in _blueprints:
		var object_id: StringName = _blueprints[cell]
		_draw_blueprint(cell, object_id, false)

	if not _dragging:
		return

	var preview_cells: Array[Vector2i]
	if _drag_tool != ERASE_TOOL and ConstructionCatalog.get_placement(_drag_tool) == "single":
		preview_cells = [_drag_start]
	else:
		preview_cells = _get_orthogonal_line(_drag_start, _drag_current)

	for cell in preview_cells:
		if _is_cell_inside_map(cell):
			_draw_blueprint(cell, _drag_tool, true)


func _draw_blueprint(cell: Vector2i, object_id: StringName, is_preview: bool) -> void:
	var color := Color(0.8, 0.2, 0.18) if object_id == ERASE_TOOL else ConstructionCatalog.get_color(object_id)
	var rect := Rect2(Vector2(cell * TILE_SIZE), Vector2.ONE * TILE_SIZE).grow(-3.0)
	var fill := color
	fill.a = 0.3 if is_preview else 0.2
	var outline := color
	outline.a = 0.95
	draw_rect(rect, fill, true)
	draw_rect(rect, outline, false, 2.0)

	if object_id == &"door":
		draw_line(rect.position + Vector2(5, 5), rect.end - Vector2(5, 5), outline, 3.0)
		draw_line(
			Vector2(rect.end.x - 5, rect.position.y + 5),
			Vector2(rect.position.x + 5, rect.end.y - 5),
			outline,
			3.0
		)


func _get_orthogonal_line(from: Vector2i, to: Vector2i) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	var delta := to - from
	if absi(delta.x) >= absi(delta.y):
		var start_x := mini(from.x, to.x)
		var end_x := maxi(from.x, to.x)
		for x in range(start_x, end_x + 1):
			result.append(Vector2i(x, from.y))
	else:
		var start_y := mini(from.y, to.y)
		var end_y := maxi(from.y, to.y)
		for y in range(start_y, end_y + 1):
			result.append(Vector2i(from.x, y))
	return result


func _world_to_cell(world_position: Vector2) -> Vector2i:
	return Vector2i(floori(world_position.x / TILE_SIZE), floori(world_position.y / TILE_SIZE))


func _is_cell_inside_map(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < MAP_SIZE.x and cell.y < MAP_SIZE.y


func _cancel_drag() -> void:
	_dragging = false
	_drag_tool = &""
