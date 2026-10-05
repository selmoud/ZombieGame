extends TestCase

const DEPOT_TO_NORTH := 0
const NORTH_TO_FIRST := 2
const DEPOT_TO_SECOND := 6
const FIRST := 3
const SECOND := 4


## Rules without random events, so every test outcome is exact.
func _calm_rules() -> SupplyRules:
	var rules := SupplyRules.new()
	rules.battle_chance = 0.0
	rules.ambush_chance = 0.0
	rules.block_chance = 0.0
	return rules


func _safe_route_to_first() -> PackedInt32Array:
	return PackedInt32Array([DEPOT_TO_NORTH, NORTH_TO_FIRST])


func test_initial_state() -> void:
	var game := SupplyGame.new(1)
	check_eq(game.day, 1)
	check_eq(game.trucks.size(), game.rules.truck_count)
	check_eq(game.companies.size(), 4)
	for company in game.companies:
		check_eq(company.stock, PackedInt32Array([3, 3, 3]))
		check_eq(company.readiness, game.rules.max_readiness)
		check(not company.battle_today, "no battle on the first day")
	check(not game.is_over())


func test_routes_are_sorted_shortest_and_safest_first() -> void:
	var game := SupplyGame.new(1)
	check_eq(game.get_routes(FIRST)[0], _safe_route_to_first())
	check_eq(game.get_routes(SECOND)[0], PackedInt32Array([DEPOT_TO_SECOND]))
	for company in game.companies:
		for route in game.get_routes(company.node):
			check(route.size() <= SupplyMap.MAX_ROUTE_LEGS)


func test_order_is_validated() -> void:
	var game := SupplyGame.new(1, _calm_rules())
	var route := _safe_route_to_first()
	check(game.give_order(0, FIRST, PackedInt32Array([0, 0, 0]), route) != "", "empty truck")
	check(game.give_order(0, FIRST, PackedInt32Array([4, 2, 1]), route) != "", "overloaded")
	check(game.give_order(0, FIRST, PackedInt32Array([-1, 2, 1]), route) != "", "negative")
	check(game.give_order(0, SECOND, PackedInt32Array([2, 2, 2]), route) != "", "wrong route")
	check(game.give_order(0, 1, PackedInt32Array([2, 2, 2]), route) != "", "hub is no target")
	check(game.give_order(99, FIRST, PackedInt32Array([2, 2, 2]), route) != "", "no truck")

	check_eq(game.give_order(0, FIRST, PackedInt32Array([2, 2, 2]), route), "")
	check(game.give_order(0, FIRST, PackedInt32Array([2, 2, 2]), route) != "", "busy truck")
	check(game.cancel_order(0))
	check_eq(game.trucks[0].state, SupplyGame.TruckState.IDLE)
	check(not game.cancel_order(0), "nothing to cancel")


func test_safe_delivery_takes_two_days_and_four_for_the_round_trip() -> void:
	var game := SupplyGame.new(1, _calm_rules())
	var first := game.get_company(FIRST)
	game.give_order(0, FIRST, PackedInt32Array([0, 3, 0]), _safe_route_to_first())

	game.end_turn()
	check_eq(first.stock[SupplyGame.Cargo.AMMO], 3, "not delivered after one day")
	game.end_turn()
	check_eq(first.stock[SupplyGame.Cargo.AMMO], 6, "delivered after two days")
	check_eq(game.trucks[0].state, SupplyGame.TruckState.RETURNING)
	game.end_turn()
	check_eq(game.trucks[0].state, SupplyGame.TruckState.RETURNING)
	game.end_turn()
	check_eq(game.trucks[0].state, SupplyGame.TruckState.IDLE)
	check_eq(game.trucks[0].node, SupplyMap.DEPOT)


func test_direct_road_delivers_the_same_day() -> void:
	var game := SupplyGame.new(1, _calm_rules())
	game.give_order(0, SECOND, PackedInt32Array([0, 3, 0]), PackedInt32Array([DEPOT_TO_SECOND]))
	game.end_turn()
	check_eq(game.get_company(SECOND).stock[SupplyGame.Cargo.AMMO], 6)
	game.end_turn()
	check_eq(game.trucks[0].state, SupplyGame.TruckState.IDLE)


func test_delivery_does_not_exceed_the_stock_cap() -> void:
	var game := SupplyGame.new(1, _calm_rules())
	game.give_order(0, SECOND, PackedInt32Array([0, 6, 0]), PackedInt32Array([DEPOT_TO_SECOND]))
	game.end_turn()
	check_eq(game.get_company(SECOND).stock[SupplyGame.Cargo.AMMO], game.rules.stock_cap)
	check_eq(game.trucks[0].cargo[SupplyGame.Cargo.AMMO], 3, "the rest goes back")


func test_unsupplied_company_loses_readiness_and_then_the_sector() -> void:
	var game := SupplyGame.new(1, _calm_rules())
	var first := game.get_company(FIRST)
	for i in 3:
		game.end_turn()
	check_eq(first.stock, PackedInt32Array([0, 3, 0]))
	check_eq(first.readiness, 5, "three days of stock")
	game.end_turn()
	check_eq(first.readiness, 3, "no food and no fuel")
	game.end_turn()
	check_eq(first.readiness, 1)
	check(not first.lost)
	game.end_turn()
	check(first.lost, "sector is lost at zero readiness")
	check(game.is_over(), "every company ran dry at once")
	check(not game.is_won())


func test_readiness_recovers_on_a_day_without_shortage() -> void:
	var game := SupplyGame.new(1, _calm_rules())
	var first := game.get_company(FIRST)
	first.readiness = 2
	game.end_turn()
	check_eq(first.readiness, 3)


func test_battle_without_ammunition_costs_readiness() -> void:
	var game := SupplyGame.new(1, _calm_rules())
	var first := game.get_company(FIRST)
	var second := game.get_company(SECOND)
	first.battle_today = true
	first.stock[SupplyGame.Cargo.AMMO] = 1
	second.battle_today = true
	game.end_turn()
	check_eq(first.readiness, 5 - game.rules.battle_penalty)
	check_eq(first.stock[SupplyGame.Cargo.AMMO], 0)
	check_eq(second.readiness, 5)
	check_eq(second.stock[SupplyGame.Cargo.AMMO], 3 - game.rules.ammo_per_battle)


func test_ambush_destroys_the_truck_only_on_risky_roads() -> void:
	var rules := _calm_rules()
	rules.ambush_chance = 1.0
	var game := SupplyGame.new(1, rules)
	game.give_order(0, SECOND, PackedInt32Array([2, 2, 2]), PackedInt32Array([DEPOT_TO_SECOND]))
	game.give_order(1, FIRST, PackedInt32Array([2, 2, 2]), _safe_route_to_first())
	game.end_turn()
	check_eq(game.trucks[0].state, SupplyGame.TruckState.LOST)
	check_eq(game.trucks[1].state, SupplyGame.TruckState.OUTBOUND)
	check_eq(game.get_company(SECOND).stock[SupplyGame.Cargo.FUEL], 2, "nothing arrived")
	check_eq(game.get_trucks_alive(), rules.truck_count - 1)
	check(game.give_order(0, FIRST, PackedInt32Array([1, 0, 0]), _safe_route_to_first()) != "")


func test_truck_waits_at_a_cut_road() -> void:
	var game := SupplyGame.new(1, _calm_rules())
	game.blocked[NORTH_TO_FIRST] = 1
	game.give_order(0, FIRST, PackedInt32Array([0, 3, 0]), _safe_route_to_first())
	check(game.is_route_blocked(_safe_route_to_first()))
	game.end_turn()
	check_eq(game.trucks[0].node, 1, "reached the hub")
	check_eq(game.blocked[NORTH_TO_FIRST], 0, "the road reopens overnight")
	game.blocked[NORTH_TO_FIRST] = 2
	game.end_turn()
	check_eq(game.trucks[0].node, 1, "waits at the hub")
	check_eq(game.trucks[0].state, SupplyGame.TruckState.OUTBOUND)


func test_truck_turns_back_from_a_lost_sector() -> void:
	var game := SupplyGame.new(1, _calm_rules())
	game.give_order(0, FIRST, PackedInt32Array([2, 2, 2]), _safe_route_to_first())
	game.get_company(FIRST).lost = true
	game.end_turn()
	game.end_turn()
	check_eq(game.trucks[0].state, SupplyGame.TruckState.RETURNING)
	check_eq(game.trucks[0].cargo, PackedInt32Array([2, 2, 2]))
	check(game.give_order(1, FIRST, PackedInt32Array([1, 0, 0]), _safe_route_to_first()) != "")


func test_mission_is_won_after_the_last_day() -> void:
	var rules := _calm_rules()
	rules.days = 2
	var game := SupplyGame.new(1, rules)
	game.end_turn()
	check(not game.is_over())
	game.end_turn()
	check(game.is_over())
	check(game.is_won())
	game.end_turn()
	check_eq(game.day, 3, "nothing happens after the end")


func test_same_seed_gives_the_same_mission() -> void:
	var left := SupplyBots.play_game(42, SupplyBots.Style.SENSIBLE)
	var right := SupplyBots.play_game(42, SupplyBots.Style.SENSIBLE)
	check_eq(left.day, right.day)
	check_eq(left.get_lost_count(), right.get_lost_count())
	check_eq(left.get_trucks_alive(), right.get_trucks_alive())
	for i in left.companies.size():
		check_eq(left.companies[i].stock, right.companies[i].stock)


## Guards the balance targets from docs/design.md against accidental rule changes.
func test_balance_targets_hold() -> void:
	var games := 300
	var wins: Dictionary[SupplyBots.Style, int] = {}
	for style: SupplyBots.Style in SupplyBots.Style.values():
		wins[style] = 0
		for i in games:
			if SupplyBots.play_game(i + 1, style).is_won():
				wins[style] += 1
	var random: float = 100.0 * wins[SupplyBots.Style.RANDOM] / games
	var cautious: float = 100.0 * wins[SupplyBots.Style.CAUTIOUS] / games
	var sensible: float = 100.0 * wins[SupplyBots.Style.SENSIBLE] / games
	check(random < 5.0, "random player wins %.1f%%" % random)
	check(cautious < 50.0, "cautious player wins %.1f%%" % cautious)
	check(sensible > 50.0 and sensible < 72.0, "sensible player wins %.1f%%" % sensible)
	check(sensible > cautious + 10.0, "risk does not pay: %.1f%% vs %.1f%%" % [sensible, cautious])
