extends TestCase

const RIFLE := UnitKind.Type.RIFLE
const APC := UnitKind.Type.APC


func _open_screen() -> BattleScreen:
	var scene: PackedScene = load(ProjectSettings.get_setting("application/run/main_scene"))
	var screen: BattleScreen = scene.instantiate()
	tree.root.add_child(screen)
	await tree.process_frame
	screen.start_mission(1)
	return screen


func _close_screen(screen: BattleScreen) -> void:
	screen.queue_free()
	await tree.process_frame


func test_mission_starts_paused_and_time_runs_only_when_unpaused() -> void:
	var screen := await _open_screen()
	check(screen.paused)
	for i in 3:
		await tree.process_frame
	check_eq(screen.battle.time, 0.0)
	screen.toggle_pause()
	screen.set_speed(4.0)
	for i in 30:
		await tree.process_frame
	check(screen.battle.time > 0.0, "time runs after unpausing")
	screen.toggle_pause()
	var stopped_at := screen.battle.time
	for i in 5:
		await tree.process_frame
	check_eq(screen.battle.time, stopped_at)
	await _close_screen(screen)


func test_clicks_select_and_order_units() -> void:
	var screen := await _open_screen()
	var battle := screen.battle
	check(screen.buy(RIFLE))
	check(screen.buy(APC))
	var squad := battle.units[battle.units.size() - 2]
	var carrier := battle.units[battle.units.size() - 1]

	screen.click_map(squad.position, MOUSE_BUTTON_LEFT)
	check_eq(screen.get_selected_unit(), squad)
	carrier.position = squad.position
	screen.click_map(squad.position + Vector2(2.1, 0.0), MOUSE_BUTTON_LEFT)
	check_eq(screen.get_selected_unit(), carrier, "units standing together are shown side by side")
	screen.click_map(squad.position, MOUSE_BUTTON_LEFT)
	carrier.position = squad.position + Vector2(0.0, 6.0)
	screen.click_map(Vector2(12.5, 21.5), MOUSE_BUTTON_RIGHT)
	check_eq(squad.order, BattleUnit.Order.MOVE)

	var objective := BattleMap.cell_centre(battle.map.objectives[0].cell)
	screen.click_map(objective, MOUSE_BUTTON_RIGHT)
	check_eq(squad.order, BattleUnit.Order.CAPTURE)
	check_eq(squad.objective, 0)

	screen.click_map(carrier.position, MOUSE_BUTTON_RIGHT)
	check_eq(squad.order, BattleUnit.Order.EMBARK, "right click on a carrier boards it")

	screen.click_map(Vector2(20.5, 2.5), MOUSE_BUTTON_LEFT)
	check_eq(screen.get_selected_unit(), null, "a click on empty ground clears the selection")
	screen.click_map(Vector2(12.5, 21.5), MOUSE_BUTTON_RIGHT)
	check_eq(squad.order, BattleUnit.Order.EMBARK, "no order without a selection")
	await _close_screen(screen)


func test_orders_to_a_carried_squad_go_to_its_carrier() -> void:
	var screen := await _open_screen()
	var battle := screen.battle
	screen.buy(RIFLE)
	screen.buy(APC)
	var squad := battle.units[battle.units.size() - 2]
	var carrier := battle.units[battle.units.size() - 1]
	battle.order_embark(squad.id, carrier.id)
	battle.advance(15.0)
	check_eq(squad.carrier, carrier.id)
	screen.select_unit(squad.id)
	screen.click_map(Vector2(12.5, 21.5), MOUSE_BUTTON_RIGHT)
	check_eq(carrier.order, BattleUnit.Order.MOVE)
	await _close_screen(screen)


func test_armed_strike_is_placed_with_a_left_click() -> void:
	var screen := await _open_screen()
	screen.set_strike_mode(true)
	screen.click_map(Vector2(29.5, 9.5), MOUSE_BUTTON_LEFT)
	check_eq(screen.battle.strikes.size(), 1)
	check_eq(screen.battle.funds, screen.battle.rules.start_funds - screen.battle.rules.strike_cost)
	screen.click_map(Vector2(29.5, 9.5), MOUSE_BUTTON_LEFT)
	check_eq(screen.battle.strikes.size(), 1, "the strike mode switches off after one strike")

	screen.set_strike_mode(true)
	screen.click_map(Vector2(29.5, 9.5), MOUSE_BUTTON_RIGHT)
	check_eq(screen.battle.strikes.size(), 1, "a right click cancels the strike mode")
	await _close_screen(screen)


func test_result_is_shown_and_a_new_mission_starts_clean() -> void:
	var screen := await _open_screen()
	screen.battle.rules.mission_time = 5.0
	screen.battle.advance(6.0)
	await tree.process_frame
	check(screen.is_result_shown())
	check(screen.paused)
	screen.start_mission(2)
	check(not screen.is_result_shown())
	check_eq(screen.battle.time, 0.0)
	await _close_screen(screen)


func test_every_event_has_a_radio_line() -> void:
	var kinds: Dictionary[StringName, bool] = {}
	for style: BattleBots.Style in [BattleBots.Style.RUSH, BattleBots.Style.RECON]:
		for seed_value in 3:
			var battle := BattleBots.play(seed_value, style)
			for event in battle.events:
				kinds[event.kind] = true
				check(not BattleText.describe_event(battle, event).is_empty(), "no text for %s" % event.kind)
	for kind: StringName in [
		&"contact", &"under_fire", &"casualties", &"retreating", &"unit_lost", &"halted",
		&"arrived_reinforcement", &"enemy_destroyed", &"objective_taken", &"objective_lost",
		&"strike_called", &"strike_landed",
	]:
		check(kinds.has(kind), "event %s never happened in the sample" % kind)
