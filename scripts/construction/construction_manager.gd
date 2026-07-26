class_name ConstructionManager
extends GridPlanningLayer

signal blueprints_changed
signal deconstruction_orders_changed
signal construction_completed(cell: Vector2i, object_id: StringName)
signal construction_removed(cell: Vector2i, object_id: StringName)
signal material_released(cell: Vector2i, item_id: StringName, quantity: int)

const ERASE_TOOL := &"erase_construction"
const DECONSTRUCT_TOOL := &"deconstruct"
const INVALID_CELL := Vector2i(-1, -1)

var _blueprints: Dictionary[Vector2i, BuildableInstance] = {}
var _blueprint_anchor_by_cell: Dictionary[Vector2i, Vector2i] = {}
var _completed_objects: Dictionary[Vector2i, BuildableInstance] = {}
var _completed_anchor_by_cell: Dictionary[Vector2i, Vector2i] = {}
var _deconstruction_orders: Dictionary[Vector2i, bool] = {}
var _staged_materials: Dictionary[Vector2i, StringName] = {}
var _placement_validator := Callable()
var _rotation_quarters := 0


func _needs_continuous_redraw() -> bool:
	return (
		(not _blueprints.is_empty() or not _deconstruction_orders.is_empty())
		and _placement_validator.is_valid()
	)


func set_active_tool(tool_id: StringName) -> void:
	if (
		tool_id != ERASE_TOOL
		and tool_id != DECONSTRUCT_TOOL
		and not ConstructionCatalog.has_tool(tool_id)
	):
		return
	_rotation_quarters = 0
	_activate_tool(tool_id)


func set_placement_validator(validator: Callable) -> void:
	_placement_validator = validator
	queue_redraw()


func place_blueprint(cell: Vector2i, object_id: StringName) -> void:
	_place_blueprint(cell, object_id, _rotation_quarters)


func _place_blueprint(
	cell: Vector2i,
	object_id: StringName,
	rotation_quarters: int
) -> void:
	if not can_place_blueprint(cell, object_id, rotation_quarters):
		return
	var preserved_material := StringName()
	var replaced_anchor := get_blueprint_anchor_at(cell)
	if replaced_anchor != INVALID_CELL:
		var old_material: StringName = _staged_materials.get(
			replaced_anchor,
			&""
		)
		if (
			replaced_anchor == cell
			and old_material
			== ConstructionCatalog.get_required_item(object_id)
		):
			preserved_material = old_material
			_remove_blueprint_at_anchor(replaced_anchor, false)
		else:
			_remove_blueprint_at_anchor(replaced_anchor)
	if _deconstruction_orders.erase(cell):
		deconstruction_orders_changed.emit()
	var instance := BuildableInstance.new(
		object_id,
		cell,
		rotation_quarters
	)
	_blueprints[cell] = instance
	for occupied_cell in instance.occupied_cells:
		_blueprint_anchor_by_cell[occupied_cell] = cell
	if not preserved_material.is_empty():
		_staged_materials[cell] = preserved_material
	blueprints_changed.emit()
	queue_redraw()


func place_line(from: Vector2i, to: Vector2i, object_id: StringName) -> void:
	if not ConstructionCatalog.has_tool(object_id):
		return
	for cell in _get_orthogonal_line(from, to):
		_place_blueprint(cell, object_id, _rotation_quarters)


func erase_line(from: Vector2i, to: Vector2i) -> void:
	var anchors_to_erase: Dictionary[Vector2i, bool] = {}
	for cell in _get_orthogonal_line(from, to):
		var blueprint_anchor := get_blueprint_anchor_at(cell)
		if blueprint_anchor != INVALID_CELL:
			anchors_to_erase[blueprint_anchor] = true
		var deconstruction_anchor := get_completed_anchor_at(cell)
		if _deconstruction_orders.has(deconstruction_anchor):
			_deconstruction_orders.erase(deconstruction_anchor)
	for anchor in anchors_to_erase:
		_remove_blueprint_at_anchor(anchor)
	blueprints_changed.emit()
	deconstruction_orders_changed.emit()
	queue_redraw()


func mark_deconstruction_line(from: Vector2i, to: Vector2i) -> void:
	for cell in _get_orthogonal_line(from, to):
		if not can_mark_for_deconstruction(cell):
			continue
		var anchor := get_completed_anchor_at(cell)
		var blueprint_anchor := get_blueprint_anchor_at(cell)
		if blueprint_anchor != INVALID_CELL:
			_remove_blueprint_at_anchor(blueprint_anchor)
		_deconstruction_orders[anchor] = true
	blueprints_changed.emit()
	deconstruction_orders_changed.emit()
	queue_redraw()


func get_blueprint_at(cell: Vector2i) -> StringName:
	var anchor := get_blueprint_anchor_at(cell)
	if anchor == INVALID_CELL:
		return &""
	return _blueprints[anchor].object_id


func get_blueprint_anchor_at(cell: Vector2i) -> Vector2i:
	return _blueprint_anchor_by_cell.get(cell, INVALID_CELL)


func stage_material(cell: Vector2i, item_id: StringName) -> bool:
	var anchor := get_blueprint_anchor_at(cell)
	if anchor == INVALID_CELL or _staged_materials.has(anchor):
		return false
	var required_item := ConstructionCatalog.get_required_item(
		_blueprints[anchor].object_id
	)
	if required_item != item_id:
		return false
	_staged_materials[anchor] = item_id
	queue_redraw()
	return true


func has_staged_material(cell: Vector2i) -> bool:
	var anchor := get_blueprint_anchor_at(cell)
	return anchor != INVALID_CELL and _staged_materials.has(anchor)


func get_staged_material(cell: Vector2i) -> StringName:
	var anchor := get_blueprint_anchor_at(cell)
	return _staged_materials.get(anchor, &"")


func can_place_blueprint(
	cell: Vector2i,
	object_id: StringName,
	rotation_quarters: int = 0
) -> bool:
	if not ConstructionCatalog.has_tool(object_id):
		return false
	var occupied_cells := ConstructionCatalog.get_occupied_cells(
		object_id,
		cell,
		rotation_quarters
	)
	var replacing_blueprint_anchor := get_blueprint_anchor_at(cell)
	if (
		replacing_blueprint_anchor != INVALID_CELL
		and replacing_blueprint_anchor != cell
	):
		return false
	for occupied_cell in occupied_cells:
		if not _is_cell_inside_map(occupied_cell):
			return false
		var blueprint_anchor := get_blueprint_anchor_at(occupied_cell)
		if (
			blueprint_anchor != INVALID_CELL
			and blueprint_anchor != replacing_blueprint_anchor
		):
			return false
		var completed_object := get_completed_object_at(occupied_cell)
		if (
			not completed_object.is_empty()
			and not (
				object_id == &"door"
				and completed_object == &"wall"
			)
		):
			return false
		if (
			_placement_validator.is_valid()
			and not bool(_placement_validator.call(occupied_cell))
		):
			return false
	return true


func can_mark_for_deconstruction(cell: Vector2i) -> bool:
	return (
		_is_cell_inside_map(cell)
		and get_completed_anchor_at(cell) != INVALID_CELL
	)


func get_blueprint_cells() -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	result.assign(_blueprints.keys())
	return result


func get_blueprint_count(object_id: StringName) -> int:
	var count := 0
	for instance: BuildableInstance in _blueprints.values():
		if instance.object_id == object_id:
			count += 1
	return count


func get_deconstruction_cells() -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	result.assign(_deconstruction_orders.keys())
	return result


func complete_blueprint(cell: Vector2i) -> bool:
	var anchor := get_blueprint_anchor_at(cell)
	if anchor == INVALID_CELL or not _staged_materials.has(anchor):
		return false
	var instance: BuildableInstance = _blueprints[anchor]
	var object_id := instance.object_id
	var required_item := ConstructionCatalog.get_required_item(object_id)
	if _staged_materials[anchor] != required_item:
		return false
	_remove_blueprint_at_anchor(anchor, false)
	_remove_completed_instances_under(instance)
	_completed_objects[anchor] = instance
	for occupied_cell in instance.occupied_cells:
		_completed_anchor_by_cell[occupied_cell] = anchor
	blueprints_changed.emit()
	for occupied_cell in instance.occupied_cells:
		construction_completed.emit(occupied_cell, object_id)
	queue_redraw()
	return true


func get_completed_object_at(cell: Vector2i) -> StringName:
	var anchor := get_completed_anchor_at(cell)
	if anchor == INVALID_CELL:
		return &""
	return _completed_objects[anchor].object_id


func get_completed_anchor_at(cell: Vector2i) -> Vector2i:
	return _completed_anchor_by_cell.get(cell, INVALID_CELL)


func complete_deconstruction(cell: Vector2i) -> bool:
	var anchor := get_completed_anchor_at(cell)
	if (
		anchor == INVALID_CELL
		or not _deconstruction_orders.has(anchor)
		or not _completed_objects.has(anchor)
	):
		return false
	var instance: BuildableInstance = _completed_objects[anchor]
	_deconstruction_orders.erase(anchor)
	_remove_completed_at_anchor(anchor)
	deconstruction_orders_changed.emit()
	for occupied_cell in instance.occupied_cells:
		construction_removed.emit(occupied_cell, instance.object_id)
	queue_redraw()
	return true


func _apply_planning_drag() -> void:
	if _drag_tool == ERASE_TOOL:
		erase_line(_drag_start, _drag_current)
	elif _drag_tool == DECONSTRUCT_TOOL:
		mark_deconstruction_line(_drag_start, _drag_current)
	elif ConstructionCatalog.get_placement(_drag_tool) == "single":
		place_blueprint(_drag_start, _drag_tool)
	else:
		place_line(_drag_start, _drag_current, _drag_tool)


func _handle_planning_event(event: InputEvent) -> bool:
	if (
		event is InputEventKey
		and event.pressed
		and not event.echo
		and event.keycode == KEY_R
		and ConstructionCatalog.is_rotatable(active_tool)
	):
		_rotation_quarters = posmod(_rotation_quarters + 1, 4)
		_cancel_drag()
		queue_redraw()
		return true
	return false


func _draw() -> void:
	for instance: BuildableInstance in _completed_objects.values():
		for cell in instance.occupied_cells:
			_draw_completed_object(cell, instance.object_id)

	for cell: Vector2i in _deconstruction_orders:
		if can_mark_for_deconstruction(cell):
			var instance: BuildableInstance = _completed_objects[cell]
			for occupied_cell in instance.occupied_cells:
				_draw_deconstruction_marker(occupied_cell, false)
		else:
			_draw_invalid_placement(cell)

	for instance: BuildableInstance in _blueprints.values():
		if can_place_blueprint(
			instance.anchor,
			instance.object_id,
			instance.rotation_quarters
		):
			for cell in instance.occupied_cells:
				_draw_blueprint(cell, instance.object_id, false)
		else:
			for cell in instance.occupied_cells:
				_draw_invalid_placement(cell)

	for cell: Vector2i in _staged_materials:
		_draw_staged_material(cell, _staged_materials[cell])

	if not _dragging:
		if _hover_visible and _is_cell_inside_map(_hover_cell):
			if active_tool == ERASE_TOOL:
				_draw_blueprint(_hover_cell, active_tool, true)
			elif active_tool == DECONSTRUCT_TOOL:
				if can_mark_for_deconstruction(_hover_cell):
					var anchor := get_completed_anchor_at(_hover_cell)
					var instance: BuildableInstance = (
						_completed_objects[anchor]
					)
					for cell in instance.occupied_cells:
						_draw_deconstruction_marker(cell, true)
				else:
					_draw_invalid_placement(_hover_cell)
			elif can_place_blueprint(
				_hover_cell,
				active_tool,
				_rotation_quarters
			):
				for cell in ConstructionCatalog.get_occupied_cells(
					active_tool,
					_hover_cell,
					_rotation_quarters
				):
					_draw_blueprint(cell, active_tool, true)
			else:
				_draw_placement_footprint(
					_hover_cell,
					active_tool,
					_rotation_quarters,
					true
				)
		return

	var preview_cells: Array[Vector2i]
	if (
		_drag_tool != ERASE_TOOL
		and _drag_tool != DECONSTRUCT_TOOL
		and ConstructionCatalog.get_placement(_drag_tool) == "single"
	):
		preview_cells = [_drag_start]
	else:
		preview_cells = _get_orthogonal_line(_drag_start, _drag_current)

	for cell in preview_cells:
		if _is_cell_inside_map(cell):
			if (
				_drag_tool == ERASE_TOOL
				or (
					_drag_tool != DECONSTRUCT_TOOL
					and can_place_blueprint(
						cell,
						_drag_tool,
						_rotation_quarters
					)
				)
			):
				_draw_placement_footprint(
					cell,
					_drag_tool,
					_rotation_quarters,
					false
				)
			elif (
				_drag_tool == DECONSTRUCT_TOOL
				and can_mark_for_deconstruction(cell)
			):
				_draw_deconstruction_marker(cell, true)
			else:
				_draw_invalid_placement(cell)


func _draw_placement_footprint(
	anchor: Vector2i,
	object_id: StringName,
	rotation_quarters: int,
	invalid: bool
) -> void:
	for cell in ConstructionCatalog.get_occupied_cells(
		object_id,
		anchor,
		rotation_quarters
	):
		if invalid or not _is_cell_inside_map(cell):
			_draw_invalid_placement(cell)
		else:
			_draw_blueprint(cell, object_id, true)


func _draw_completed_object(cell: Vector2i, object_id: StringName) -> void:
	var color := ConstructionCatalog.get_color(object_id).darkened(0.22)
	var rect := Rect2(Vector2(cell * TILE_SIZE), Vector2.ONE * TILE_SIZE)
	if object_id == &"door":
		draw_rect(rect.grow(-5.0), color, true)
		draw_line(
			rect.position + Vector2(8, 8),
			rect.end - Vector2(8, 8),
			color.lightened(0.3),
			3.0
		)
	elif object_id == &"barricade":
		draw_rect(rect.grow(-7.0), color, true)
		draw_line(
			Vector2(rect.position.x + 5, rect.get_center().y),
			Vector2(rect.end.x - 5, rect.get_center().y),
			color.lightened(0.25),
			3.0
		)
	else:
		draw_rect(rect.grow(-2.0), color, true)
		draw_rect(rect.grow(-2.0), color.lightened(0.18), false, 2.0)


func _draw_staged_material(cell: Vector2i, item_id: StringName) -> void:
	var color := SupplyDepot.get_item_color(item_id)
	var rect := Rect2(
		Vector2(cell * TILE_SIZE) + Vector2(9, 19),
		Vector2(14, 9)
	)
	draw_rect(rect, color, true)
	draw_rect(rect, Color.WHITE, false, 1.0)


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


func _draw_deconstruction_marker(cell: Vector2i, is_preview: bool) -> void:
	var rect := Rect2(Vector2(cell * TILE_SIZE), Vector2.ONE * TILE_SIZE).grow(-6.0)
	var color := Color("e3a447")
	if is_preview:
		var fill := color
		fill.a = 0.2
		draw_rect(rect, fill, true)
	draw_rect(rect, color, false, 2.0)
	draw_line(rect.position + Vector2(2, 2), rect.end - Vector2(2, 2), color, 3.0)
	draw_line(
		Vector2(rect.end.x - 2, rect.position.y + 2),
		Vector2(rect.position.x + 2, rect.end.y - 2),
		color,
		3.0
	)


func _draw_invalid_placement(cell: Vector2i) -> void:
	var rect := Rect2(Vector2(cell * TILE_SIZE), Vector2.ONE * TILE_SIZE).grow(-5.0)
	var color := Color("e34f47")
	var fill := color
	fill.a = 0.2
	draw_rect(rect, fill, true)
	draw_rect(rect, color, false, 2.0)
	draw_line(rect.position + Vector2(3, 3), rect.end - Vector2(3, 3), color, 4.0)
	draw_line(
		Vector2(rect.end.x - 3, rect.position.y + 3),
		Vector2(rect.position.x + 3, rect.end.y - 3),
		color,
		4.0
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


func _release_staged_material(cell: Vector2i) -> void:
	var anchor := get_blueprint_anchor_at(cell)
	if anchor == INVALID_CELL:
		anchor = cell
	if not _staged_materials.has(anchor):
		return
	var item_id: StringName = _staged_materials[anchor]
	_staged_materials.erase(anchor)
	material_released.emit(anchor, item_id, 1)


func _remove_blueprint_at_anchor(
	anchor: Vector2i,
	release_material: bool = true
) -> void:
	if not _blueprints.has(anchor):
		return
	if release_material:
		_release_staged_material(anchor)
	else:
		_staged_materials.erase(anchor)
	var instance: BuildableInstance = _blueprints[anchor]
	for occupied_cell in instance.occupied_cells:
		if _blueprint_anchor_by_cell.get(
			occupied_cell,
			INVALID_CELL
		) == anchor:
			_blueprint_anchor_by_cell.erase(occupied_cell)
	_blueprints.erase(anchor)


func _remove_completed_instances_under(instance: BuildableInstance) -> void:
	var anchors: Dictionary[Vector2i, bool] = {}
	for occupied_cell in instance.occupied_cells:
		var anchor := get_completed_anchor_at(occupied_cell)
		if anchor != INVALID_CELL:
			anchors[anchor] = true
	for anchor in anchors:
		_remove_completed_at_anchor(anchor)


func _remove_completed_at_anchor(anchor: Vector2i) -> void:
	if not _completed_objects.has(anchor):
		return
	var instance: BuildableInstance = _completed_objects[anchor]
	for occupied_cell in instance.occupied_cells:
		if _completed_anchor_by_cell.get(
			occupied_cell,
			INVALID_CELL
		) == anchor:
			_completed_anchor_by_cell.erase(occupied_cell)
	_completed_objects.erase(anchor)
