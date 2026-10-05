extends SceneTree
## Plays many missions with each automatic player and prints how they do.
## Usage: tools/godot.sh --script res://tools/balance.gd -- [games] [rule=value ...]
## Example: ... -- 2000 truck_count=5 battle_chance=0.45

const DEFAULT_GAMES := 1000


func _init() -> void:
	var games := DEFAULT_GAMES
	var rules := SupplyRules.new()
	for arg in OS.get_cmdline_user_args():
		if arg.is_valid_int():
			games = maxi(arg.to_int(), 1)
			continue
		var pair := arg.split("=")
		if pair.size() != 2 or not pair[0] in rules:
			print("unknown argument: %s" % arg)
			quit(1)
			return
		rules.set(pair[0], str_to_var(pair[1]))
		print("%s = %s" % [pair[0], rules.get(pair[0])])

	print("%d missions per player" % games)
	print("%-9s %7s %12s %12s %10s" % ["player", "wins", "lost sectors", "lost trucks", "last day"])
	for style: SupplyBots.Style in SupplyBots.Style.values():
		var wins := 0
		var lost_sectors := 0
		var lost_trucks := 0
		var last_day := 0
		for i in games:
			var game := SupplyBots.play_game(i + 1, style, rules)
			if game.is_won():
				wins += 1
			lost_sectors += game.get_lost_count()
			lost_trucks += game.rules.truck_count - game.get_trucks_alive()
			last_day += game.day - 1
		print("%-9s %6.1f%% %12.2f %12.2f %10.1f" % [
			(SupplyBots.Style.keys()[style] as String).to_lower(),
			100.0 * wins / games,
			float(lost_sectors) / games,
			float(lost_trucks) / games,
			float(last_day) / games,
		])
	quit()
