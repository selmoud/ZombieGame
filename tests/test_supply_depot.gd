extends SceneTree


func _init() -> void:
	var supplies := SupplyDepot.new()
	var box_cell := Vector2i(3, 4)
	supplies.add_box(box_cell, &"wall_section", 2)

	assert(supplies.has_box_at(box_cell))
	assert(supplies.get_total_quantity(&"wall_section") == 2)
	assert(supplies.reserve_from_box(box_cell, &"wall_section", 10))
	assert(supplies.reserve_from_box(box_cell, &"wall_section", 11))
	assert(not supplies.reserve_from_box(box_cell, &"wall_section", 12))

	assert(supplies.take_reserved_item(10) == &"wall_section")
	assert(supplies.get_total_quantity(&"wall_section") == 1)
	supplies.release_reservation(11)
	assert(supplies.reserve_from_box(box_cell, &"wall_section", 12))
	assert(supplies.take_reserved_item(12) == &"wall_section")
	assert(supplies.get_total_quantity(&"wall_section") == 0)

	supplies.return_item_to_box(box_cell, &"wall_section")
	assert(supplies.get_total_quantity(&"wall_section") == 1)

	print("SupplyDepot tests passed")
	supplies.free()
	quit()
