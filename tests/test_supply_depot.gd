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

	supplies.add_box(Vector2i(5, 5), &"wall_section", 8)
	assert(
		supplies.reserve_quantity_from_box(
			Vector2i(5, 5),
			&"wall_section",
			6,
			20
		)
	)
	var batch := supplies.take_reserved_quantity(20)
	assert(batch["quantity"] == 6)
	assert(supplies.get_quantity_in_box(Vector2i(5, 5)) == 2)

	supplies.drop_loose_items(Vector2i(7, 7), &"wall_section", 2)
	assert(supplies.get_loose_quantity(Vector2i(7, 7), &"wall_section") == 2)
	assert(supplies.get_total_loose_quantity() == 2)

	print("SupplyDepot tests passed")
	supplies.free()
	quit()
