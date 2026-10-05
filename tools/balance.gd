extends SceneTree
## Plays many missions with each automatic player and prints how they do.
## Usage: tools/godot.sh --script res://tools/balance.gd -- [missions] [rule=value ...]
## Example: ... -- 200 enemy_reinforce_interval=140 income=1.5

const DEFAULT_MISSIONS := 100


func _init() -> void:
	var missions := DEFAULT_MISSIONS
	var rules := BattleRules.new()
	for arg in OS.get_cmdline_user_args():
		if arg.is_valid_int():
			missions = maxi(arg.to_int(), 1)
			continue
		var pair := arg.split("=")
		if pair.size() != 2 or not pair[0] in rules:
			print("unknown argument: %s" % arg)
			quit(1)
			return
		rules.set(pair[0], str_to_var(pair[1]))
		print("%s = %s" % [pair[0], rules.get(pair[0])])

	print("%d missions per player" % missions)
	print("%-6s %7s %9s %10s %10s %8s" % ["player", "wins", "end time", "units lost", "units left", "held"])
	for style: BattleBots.Style in BattleBots.Style.values():
		var wins := 0
		var time := 0.0
		var lost := 0
		var left := 0
		var held := 0
		for i in missions:
			var battle := BattleBots.play(i + 1, style, rules)
			if battle.result == Battle.Result.WON:
				wins += 1
			time += battle.time
			left += battle.count_units(BattleUnit.Side.PLAYER)
			lost += battle.count_units(BattleUnit.Side.PLAYER, false) - battle.count_units(BattleUnit.Side.PLAYER)
			held += battle.count_held(BattleUnit.Side.PLAYER)
		print("%-6s %6.1f%% %9s %10.1f %10.1f %8.2f" % [
			(BattleBots.Style.keys()[style] as String).to_lower(),
			100.0 * wins / missions,
			BattleText.clock(time / missions),
			float(lost) / missions, float(left) / missions, float(held) / missions,
		])
	quit()
