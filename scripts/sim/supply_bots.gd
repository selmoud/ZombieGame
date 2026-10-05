class_name SupplyBots
extends RefCounted
## Automatic players used to check the balance. They only use the public
## interface of SupplyGame, the same one the screen uses.

enum Style {
	## Sends random loads to random companies by random routes.
	RANDOM,
	## Supplies by need, never uses a risky road.
	CAUTIOUS,
	## Supplies by need, takes a risky road when the safe one would be too late.
	SENSIBLE,
}

## A truck is not sent with less than this load unless a company is about to run dry.
const MIN_LOAD := 3


static func play_turn(game: SupplyGame, style: Style, rng: RandomNumberGenerator) -> void:
	if style == Style.RANDOM:
		_play_random(game, rng)
	else:
		_play_by_need(game, style == Style.SENSIBLE)


static func play_game(seed_value: int, style: Style, rules: SupplyRules = null) -> SupplyGame:
	var game := SupplyGame.new(seed_value, rules)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value + 7919
	while not game.is_over():
		play_turn(game, style, rng)
		game.end_turn()
	return game


static func _play_random(game: SupplyGame, rng: RandomNumberGenerator) -> void:
	var targets: Array[SupplyGame.Company] = []
	for company in game.companies:
		if not company.lost:
			targets.append(company)
	if targets.is_empty():
		return
	for truck in game.trucks:
		if truck.state != SupplyGame.TruckState.IDLE:
			continue
		var company := targets[rng.randi_range(0, targets.size() - 1)]
		var routes := game.get_routes(company.node)
		var cargo := PackedInt32Array([0, 0, 0])
		for i in game.rules.truck_capacity:
			cargo[rng.randi_range(0, SupplyGame.CARGO_COUNT - 1)] += 1
		game.give_order(truck.id, company.node, cargo, routes[rng.randi_range(0, routes.size() - 1)])


static func _play_by_need(game: SupplyGame, allow_risk: bool) -> void:
	for truck in game.trucks:
		if truck.state != SupplyGame.TruckState.IDLE:
			continue
		var best := {}
		for company in game.companies:
			if company.lost:
				continue
			var plan := _plan_for(game, company, allow_risk)
			if not plan.is_empty() and (best.is_empty() or plan.score > best.score):
				best = plan
		if best.is_empty():
			return
		game.give_order(truck.id, best.company, best.cargo, best.route)


## Best route and load for one more truck to this company, or an empty dictionary.
static func _plan_for(game: SupplyGame, company: SupplyGame.Company, allow_risk: bool) -> Dictionary:
	var safe_route := PackedInt32Array()
	var risky_route := PackedInt32Array()
	for route in game.get_routes(company.node):
		if game.is_route_blocked(route):
			continue
		if game.map.count_risky(route) == 0:
			if safe_route.is_empty():
				safe_route = route
		elif risky_route.is_empty() or _is_less_risky(game, route, risky_route):
			risky_route = route

	var safe_plan := _plan_route(game, company, safe_route)
	if not allow_risk:
		return safe_plan
	var risky_plan := _plan_route(game, company, risky_route)
	if risky_plan.is_empty():
		return safe_plan
	# Risk is worth it only when it prevents a shortage the safe road cannot.
	var faster := safe_route.is_empty() or risky_route.size() < safe_route.size()
	if faster and risky_plan.urgent:
		return risky_plan
	return safe_plan if not safe_plan.is_empty() else {}


static func _is_less_risky(game: SupplyGame, left: PackedInt32Array, right: PackedInt32Array) -> bool:
	var left_risk := game.map.count_risky(left)
	var right_risk := game.map.count_risky(right)
	if left_risk != right_risk:
		return left_risk < right_risk
	return left.size() < right.size()


static func _plan_route(
	game: SupplyGame, company: SupplyGame.Company, route: PackedInt32Array
) -> Dictionary:
	if route.is_empty():
		return {}
	var rules := game.rules
	var legs := route.size()
	# Stock expected when this truck arrives: what is there, plus trucks already
	# on the way, minus what the company eats before the arrival.
	var expected := company.stock.duplicate()
	for truck in game.trucks:
		var on_the_way := (
			truck.state == SupplyGame.TruckState.LOADED
			or truck.state == SupplyGame.TruckState.OUTBOUND
		)
		if on_the_way and truck.target == company.node:
			for cargo in SupplyGame.CARGO_COUNT:
				expected[cargo] += truck.cargo[cargo]
	var days_before := legs - 1
	expected[SupplyGame.Cargo.FOOD] -= rules.food_per_day * days_before
	expected[SupplyGame.Cargo.FUEL] -= rules.fuel_per_day * days_before
	if days_before >= 1 and company.battle_today:
		expected[SupplyGame.Cargo.AMMO] -= rules.ammo_per_battle

	var battle_on_arrival := company.battle_today if legs == 1 else company.battle_tomorrow
	var needed := PackedInt32Array([0, 0, 0])
	needed[SupplyGame.Cargo.FOOD] = rules.food_per_day
	needed[SupplyGame.Cargo.FUEL] = rules.fuel_per_day
	needed[SupplyGame.Cargo.AMMO] = rules.ammo_per_battle if battle_on_arrival or legs > 2 else 0

	var urgent := false
	var room := PackedInt32Array([0, 0, 0])
	var score := 0.0
	for cargo in SupplyGame.CARGO_COUNT:
		expected[cargo] = clampi(expected[cargo], 0, rules.stock_cap)
		room[cargo] = rules.stock_cap - expected[cargo]
		score += room[cargo]
		if expected[cargo] < needed[cargo]:
			urgent = true
			score += 10.0
	score += (rules.max_readiness - company.readiness) * 2.0

	var load := PackedInt32Array([0, 0, 0])
	var total := 0
	while total < rules.truck_capacity:
		var pick := -1
		for cargo in SupplyGame.CARGO_COUNT:
			if room[cargo] > 0 and (pick < 0 or room[cargo] > room[pick]):
				pick = cargo
		if pick < 0:
			break
		load[pick] += 1
		room[pick] -= 1
		total += 1
	if total == 0 or (total < MIN_LOAD and not urgent):
		return {}
	return {
		"company": company.node, "route": route, "cargo": load,
		"score": score, "urgent": urgent,
	}
