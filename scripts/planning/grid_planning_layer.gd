class_name GridPlanningLayer
extends Node2D

signal active_tool_changed(tool_id: StringName)

const TILE_SIZE := WorldConfig.TILE_SIZE
const MAP_SIZE := WorldConfig.MAP_SIZE

var active_tool: StringName = &""
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
	elif _needs_continuous_redraw():
		queue_redraw()


func _activate_tool(tool_id: StringName) -> void:
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


func is_hover_preview_visible() -> bool:
	return _hover_visible and _is_cell_inside_map(_hover_cell)


func _unhandled_input(event: InputEvent) -> void:
	if (
		event is InputEventKey
		and event.is_pressed()
		and event.keycode == KEY_ESCAPE
	):
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

	if _handle_planning_event(event):
		get_viewport().set_input_as_handled()
		return

	if active_tool.is_empty():
		return

	if event is InputEventMouseButton:
		if event.button_index != MOUSE_BUTTON_LEFT:
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
			_apply_planning_drag()
			_cancel_drag()
		queue_redraw()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and _dragging:
		_drag_current = _world_to_cell(get_global_mouse_position())
		queue_redraw()
		get_viewport().set_input_as_handled()


func _apply_planning_drag() -> void:
	pass


func _handle_planning_event(_event: InputEvent) -> bool:
	return false


func _needs_continuous_redraw() -> bool:
	return false


func _world_to_cell(world_position: Vector2) -> Vector2i:
	return Vector2i(
		floori(world_position.x / TILE_SIZE),
		floori(world_position.y / TILE_SIZE)
	)


func _is_cell_inside_map(cell: Vector2i) -> bool:
	return (
		cell.x >= 0
		and cell.y >= 0
		and cell.x < MAP_SIZE.x
		and cell.y < MAP_SIZE.y
	)


func _cancel_drag() -> void:
	_dragging = false
	_drag_tool = &""
