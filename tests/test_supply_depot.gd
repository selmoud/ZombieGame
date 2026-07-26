extends SceneTree


func _init() -> void:
	var supplies := SupplyDepot.new()
	var box_cell := Vector2i(3, 4)
	supplies.add_box(box_cell, &"wall_section", 2)

	assert(supplies.has_box_at(box_cell))
	assert(supplies.get_total_quantity(&"wall_section") == 2)
	assert(supplies.reserve_quantity_from_source(
		box_cell, SupplyDepot.SOURCE_BOX, &"wall_section", 1, 10
	))
	assert(supplies.reserve_quantity_from_source(
		box_cell, SupplyDepot.SOURCE_BOX, &"wall_section", 1, 11
	))
	assert(not supplies.reserve_quantity_from_source(
		box_cell, SupplyDepot.SOURCE_BOX, &"wall_section", 1, 12
	))

	assert(supplies.take_reserved_quantity(10)["item_id"] == &"wall_section")
	assert(supplies.get_total_quantity(&"wall_section") == 1)
	supplies.release_reservation(11)
	assert(supplies.reserve_quantity_from_source(
		box_cell, SupplyDepot.SOURCE_BOX, &"wall_section", 1, 12
	))
	assert(supplies.take_reserved_quantity(12)["item_id"] == &"wall_section")
	assert(supplies.get_total_quantity(&"wall_section") == 0)

	supplies.return_items_to_source(
		box_cell, SupplyDepot.SOURCE_BOX, &"wall_section", 1
	)
	assert(supplies.get_total_quantity(&"wall_section") == 1)

	supplies.add_box(Vector2i(5, 5), &"wall_section", 8)
	assert(
		supplies.reserve_quantity_from_source(
			Vector2i(5, 5),
			SupplyDepot.SOURCE_BOX,
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
	assert(
		supplies.reserve_quantity_from_source(
			Vector2i(7, 7),
			SupplyDepot.SOURCE_LOOSE,
			&"wall_section",
			2,
			14
		)
	)
	assert(not supplies.reserve_quantity_from_source(
		Vector2i(7, 7),
		SupplyDepot.SOURCE_LOOSE,
		&"wall_section",
		1,
		15
	))
	var loose_taken := supplies.take_reserved_quantity(14)
	assert(loose_taken["source_type"] == SupplyDepot.SOURCE_LOOSE)
	assert(loose_taken["quantity"] == 2)
	assert(supplies.get_loose_quantity(Vector2i(7, 7), &"wall_section") == 0)
	supplies.return_items_to_source(
		Vector2i(7, 7),
		SupplyDepot.SOURCE_LOOSE,
		&"wall_section",
		1
	)
	assert(supplies.get_loose_quantity(Vector2i(7, 7), &"wall_section") == 1)
	assert(ItemCatalog.is_furniture(&"bunk_bed"))
	assert(not ItemCatalog.is_furniture(&"wall_section"))
	assert(supplies.has_valid_state())

	print("SupplyDepot tests passed")
	supplies.free()
	quit()
