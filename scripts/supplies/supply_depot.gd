class_name SupplyDepot
extends Node2D

signal inventory_changed

const TILE_SIZE := WorldConfig.TILE_SIZE
const SOURCE_BOX := &"box"
const SOURCE_LOOSE := &"loose"

var _boxes: Dictionary[Vector2i, Dictionary] = {}
var _reservations: Dictionary[int, Dictionary] = {}
var _loose_piles: Dictionary[Vector2i, Dictionary] = {}


func _ready() -> void:
	add_box(Vector2i(29, 31), &"wall_section", 24)
	add_box(Vector2i(29, 33), &"door_module", 6)
	add_box(Vector2i(29, 35), &"debris", 12)


func add_box(cell: Vector2i, item_id: StringName, quantity: int) -> void:
	_boxes[cell] = {
		"item_id": item_id,
		"quantity": maxi(quantity, 0),
	}
	inventory_changed.emit()
	queue_redraw()


func has_box_at(cell: Vector2i) -> bool:
	return _boxes.has(cell)


func get_available_boxes(item_id: StringName) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	for cell: Vector2i in _boxes:
		if (
			_boxes[cell]["item_id"] == item_id
			and _get_available_in_box(cell) > 0
		):
			result.append(cell)
	return result


func get_available_sources(item_id: StringName) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for cell: Vector2i in _loose_piles:
		if _get_available_loose(cell, item_id) > 0:
			result.append({
				"cell": cell,
				"source_type": SOURCE_LOOSE,
				"quantity": _get_available_loose(cell, item_id),
			})
	for cell in get_available_boxes(item_id):
		result.append({
			"cell": cell,
			"source_type": SOURCE_BOX,
			"quantity": _get_available_in_box(cell),
		})
	return result


func reserve_quantity_from_source(
	cell: Vector2i,
	source_type: StringName,
	item_id: StringName,
	quantity: int,
	agent_id: int
) -> bool:
	if _reservations.has(agent_id):
		return false
	if quantity <= 0:
		return false
	var available := 0
	if source_type == SOURCE_BOX:
		if not _boxes.has(cell) or _boxes[cell]["item_id"] != item_id:
			return false
		available = _get_available_in_box(cell)
	elif source_type == SOURCE_LOOSE:
		available = _get_available_loose(cell, item_id)
	else:
		return false
	if available < quantity:
		return false
	_reservations[agent_id] = {
		"cell": cell,
		"source_type": source_type,
		"item_id": item_id,
		"quantity": quantity,
	}
	return true


func has_reservation(agent_id: int) -> bool:
	return _reservations.has(agent_id)


func take_reserved_quantity(agent_id: int) -> Dictionary:
	if not _reservations.has(agent_id):
		return {}
	var reservation: Dictionary = _reservations[agent_id]
	var cell: Vector2i = reservation["cell"]
	var source_type: StringName = reservation["source_type"]
	var item_id: StringName = reservation["item_id"]
	var quantity: int = reservation["quantity"]
	_reservations.erase(agent_id)
	if source_type == SOURCE_BOX:
		if not _boxes.has(cell) or int(_boxes[cell]["quantity"]) < quantity:
			return {}
		_boxes[cell]["quantity"] = int(_boxes[cell]["quantity"]) - quantity
	elif source_type == SOURCE_LOOSE:
		if get_loose_quantity(cell, item_id) < quantity:
			return {}
		var pile: Dictionary = _loose_piles[cell]
		pile[item_id] = int(pile[item_id]) - quantity
		if int(pile[item_id]) <= 0:
			pile.erase(item_id)
		if pile.is_empty():
			_loose_piles.erase(cell)
	else:
		return {}
	inventory_changed.emit()
	queue_redraw()
	return {
		"cell": cell,
		"source_type": source_type,
		"item_id": item_id,
		"quantity": quantity,
	}


func release_reservation(agent_id: int) -> void:
	_reservations.erase(agent_id)


func return_items_to_box(
	cell: Vector2i,
	item_id: StringName,
	quantity: int
) -> void:
	if not _boxes.has(cell) or _boxes[cell]["item_id"] != item_id:
		return
	_boxes[cell]["quantity"] = int(_boxes[cell]["quantity"]) + maxi(quantity, 0)
	inventory_changed.emit()
	queue_redraw()


func return_items_to_source(
	cell: Vector2i,
	source_type: StringName,
	item_id: StringName,
	quantity: int
) -> void:
	if source_type == SOURCE_BOX:
		return_items_to_box(cell, item_id, quantity)
	else:
		drop_loose_items(cell, item_id, quantity)


func drop_loose_items(
	cell: Vector2i,
	item_id: StringName,
	quantity: int
) -> void:
	if quantity <= 0:
		return
	if not _loose_piles.has(cell):
		_loose_piles[cell] = {}
	var pile: Dictionary = _loose_piles[cell]
	pile[item_id] = int(pile.get(item_id, 0)) + quantity
	inventory_changed.emit()
	queue_redraw()


func get_loose_quantity(cell: Vector2i, item_id: StringName) -> int:
	if not _loose_piles.has(cell):
		return 0
	return int(_loose_piles[cell].get(item_id, 0))


func get_total_loose_quantity() -> int:
	var total := 0
	for pile: Dictionary in _loose_piles.values():
		for quantity: int in pile.values():
			total += quantity
	return total


func get_quantity_in_box(cell: Vector2i) -> int:
	if not _boxes.has(cell):
		return 0
	return int(_boxes[cell]["quantity"])


func get_total_quantity(item_id: StringName) -> int:
	var total := 0
	for box: Dictionary in _boxes.values():
		if box["item_id"] == item_id:
			total += int(box["quantity"])
	return total


func get_summary_text() -> String:
	return "Стены: %d  •  Двери: %d  •  Обломки: %d  •  На земле: %d" % [
		get_total_quantity(&"wall_section"),
		get_total_quantity(&"door_module"),
		get_total_quantity(&"debris"),
		get_total_loose_quantity(),
	]


static func get_item_color(item_id: StringName) -> Color:
	return ItemCatalog.get_color(item_id)


func _get_available_in_box(cell: Vector2i) -> int:
	if not _boxes.has(cell):
		return 0
	var reserved := 0
	for reservation: Dictionary in _reservations.values():
		if (
			reservation["source_type"] == SOURCE_BOX
			and reservation["cell"] == cell
		):
			reserved += int(reservation["quantity"])
	return int(_boxes[cell]["quantity"]) - reserved


func _get_available_loose(cell: Vector2i, item_id: StringName) -> int:
	var reserved := 0
	for reservation: Dictionary in _reservations.values():
		if (
			reservation["source_type"] == SOURCE_LOOSE
			and reservation["cell"] == cell
			and reservation["item_id"] == item_id
		):
			reserved += int(reservation["quantity"])
	return get_loose_quantity(cell, item_id) - reserved


func _draw() -> void:
	for cell: Vector2i in _boxes:
		var box: Dictionary = _boxes[cell]
		var rect := Rect2(Vector2(cell * TILE_SIZE), Vector2.ONE * TILE_SIZE)
		var item_color := get_item_color(box["item_id"])
		draw_rect(rect.grow(-3.0), Color("6f5335"), true)
		draw_rect(rect.grow(-3.0), Color("b58a59"), false, 2.0)
		draw_rect(
			Rect2(rect.position + Vector2(5, 5), Vector2(TILE_SIZE - 10, 5)),
			item_color,
			true
		)
		draw_string(
			ThemeDB.fallback_font,
			rect.position + Vector2(0, 25),
			str(box["quantity"]),
			HORIZONTAL_ALIGNMENT_CENTER,
			TILE_SIZE,
			13,
			Color.WHITE
		)

	for cell: Vector2i in _loose_piles:
		var pile: Dictionary = _loose_piles[cell]
		var offset_index := 0
		for item_id: StringName in pile:
			var quantity: int = pile[item_id]
			if quantity <= 0:
				continue
			var color := get_item_color(item_id)
			var origin := (
				Vector2(cell * TILE_SIZE)
				+ Vector2(5 + offset_index * 7, 18)
			)
			draw_rect(Rect2(origin, Vector2(10, 7)), color, true)
			draw_rect(Rect2(origin, Vector2(10, 7)), Color.WHITE, false, 1.0)
			offset_index += 1
