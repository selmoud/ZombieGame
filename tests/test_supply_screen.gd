extends TestCase

const SECOND := 4
const SAFE_TO_SECOND: PackedInt32Array = [0, 3]
const DIRECT_TO_SECOND: PackedInt32Array = [6]


func _open_screen() -> SupplyScreen:
	var scene: PackedScene = load(ProjectSettings.get_setting("application/run/main_scene"))
	var screen: SupplyScreen = scene.instantiate()
	tree.root.add_child(screen)
	await tree.process_frame
	screen.start_mission(1)
	return screen


func _close_screen(screen: SupplyScreen) -> void:
	screen.queue_free()
	await tree.process_frame


func test_order_is_given_through_the_editor() -> void:
	var screen := await _open_screen()
	check_eq(screen.get_draft().truck, -1)
	check(not screen.can_confirm())

	screen.select_truck(0)
	check(not screen.can_confirm(), "no target yet")
	screen.select_target(SECOND)
	check_eq(screen.get_draft().route, SAFE_TO_SECOND, "the safe road is preselected")
	check(screen.can_confirm())
	check(screen.confirm_order())

	var truck := screen.game.trucks[0]
	check_eq(truck.state, SupplyGame.TruckState.LOADED)
	check_eq(truck.target, SECOND)
	check_eq(truck.cargo, PackedInt32Array([2, 2, 2]))
	check_eq(truck.route, SAFE_TO_SECOND)
	check_eq(screen.get_draft().truck, -1, "editor closes after sending")

	screen.cancel_order(0)
	check_eq(truck.state, SupplyGame.TruckState.IDLE)
	await _close_screen(screen)


func test_risky_road_is_used_only_when_chosen() -> void:
	var screen := await _open_screen()
	screen.select_truck(1)
	screen.select_target(SECOND)
	screen.select_route(0)
	check_eq(screen.get_draft().route, DIRECT_TO_SECOND)
	check(screen.confirm_order())
	check_eq(screen.game.trucks[1].route, DIRECT_TO_SECOND)
	await _close_screen(screen)


func test_open_risky_road_is_preselected_when_the_safe_one_is_cut() -> void:
	var screen := await _open_screen()
	screen.game.blocked[SAFE_TO_SECOND[1]] = 2
	screen.select_truck(0)
	screen.select_target(SECOND)
	check_eq(screen.get_draft().route, DIRECT_TO_SECOND)
	await _close_screen(screen)


func test_cargo_stays_within_the_truck_capacity() -> void:
	var screen := await _open_screen()
	screen.select_truck(0)
	screen.select_target(SECOND)
	screen.change_cargo(SupplyGame.Cargo.AMMO, 1)
	check_eq(screen.get_draft().cargo, PackedInt32Array([2, 2, 2]), "the truck is full")
	screen.change_cargo(SupplyGame.Cargo.FUEL, -2)
	screen.change_cargo(SupplyGame.Cargo.FUEL, -1)
	check_eq(screen.get_draft().cargo, PackedInt32Array([0, 2, 2]), "not below zero")
	screen.change_cargo(SupplyGame.Cargo.AMMO, 2)
	check_eq(screen.get_draft().cargo, PackedInt32Array([0, 4, 2]))
	screen.change_cargo(SupplyGame.Cargo.AMMO, -4)
	screen.change_cargo(SupplyGame.Cargo.FOOD, -2)
	check(not screen.can_confirm(), "an empty truck cannot be sent")
	check(not screen.confirm_order())
	await _close_screen(screen)


func test_busy_truck_and_lost_sector_cannot_be_selected() -> void:
	var screen := await _open_screen()
	screen.select_truck(0)
	screen.select_target(SECOND)
	screen.confirm_order()
	screen.select_truck(0)
	check_eq(screen.get_draft().truck, -1, "a loaded truck is not editable")

	screen.game.get_company(SECOND).lost = true
	screen.select_truck(1)
	screen.select_target(SECOND)
	check_eq(screen.get_draft().target, -1)
	await _close_screen(screen)


func test_mission_plays_to_the_result_and_restarts() -> void:
	var screen := await _open_screen()
	var rng := RandomNumberGenerator.new()
	rng.seed = 1
	check(not screen.is_result_shown())
	while not screen.game.is_over():
		SupplyBots.play_turn(screen.game, SupplyBots.Style.SENSIBLE, rng)
		screen.end_turn()
	check(screen.is_result_shown())
	var last_day := screen.game.day
	screen.end_turn()
	check_eq(screen.game.day, last_day, "no turns after the end")

	screen.start_mission(2)
	check(not screen.is_result_shown())
	check_eq(screen.game.day, 1)
	await _close_screen(screen)


func test_every_event_has_a_report_line() -> void:
	var rng := RandomNumberGenerator.new()
	var kinds: Dictionary[StringName, bool] = {}
	for seed_value in 40:
		var game := SupplyGame.new(seed_value)
		rng.seed = seed_value
		while not game.is_over():
			SupplyBots.play_turn(game, SupplyBots.Style.RANDOM, rng)
			game.end_turn()
			for event in game.events:
				kinds[event.kind] = true
				check(not SupplyText.describe_event(game, event).is_empty(), "no text for %s" % event.kind)
	for kind: StringName in [
		&"delivered", &"ambush", &"waiting", &"turned_back",
		&"shortage", &"sector_lost", &"road_cut", &"road_opened",
	]:
		check(kinds.has(kind), "event %s never happened in the sample" % kind)
