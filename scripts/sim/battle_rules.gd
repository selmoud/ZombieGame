class_name BattleRules
extends Resource
## Tunable numbers of a mission. Times are in seconds, distances in cells.

@export var mission_time := 1200.0
## Hold this many objectives...
@export var objectives_to_win := 2
## ...for this long without a break to win.
@export var hold_to_win := 120.0
@export var start_funds := 500.0
## The group cannot have more units than this, counting those on their way.
@export var max_units := 6
## Per held objective per second.
@export var income := 1.2
@export var capture_time := 20.0
@export var capture_radius := 2.5
## Delay before a unit bought after the start arrives.
@export var arrival_delay := 15.0
@export var strike_cost := 60.0
@export var strike_delay := 8.0
@export var strike_radius := 2.5
@export var strike_scatter := 1.5
## Share of full strength lost by a unit in the open inside the strike.
@export var strike_damage_min := 0.5
@export var strike_damage_max := 0.9
## How much of the terrain's cover works against shells: 0 none, 1 as against bullets.
@export var strike_cover := 0.5
## Strength lost per second by a target of a full-strength unit with firepower 1.
@export var damage_rate := 0.2
## A unit fired on by an enemy its side did not know about is caught off guard:
## for `surprise_time` it takes `surprise_factor` times the damage.
@export var surprise_time := 8.0
@export var surprise_factor := 2.0
## The enemy counts as known when it has been watched for at least this long.
@export var surprise_warning := 3.0
## A unit weaker than this share of full strength pulls back when hit.
@export var retreat_threshold := 0.3
## A unit resting this close to its base gets one man back every `refit_interval`.
@export var refit_radius := 3.5
@export var refit_interval := 5.0
## A contact nobody sees any more disappears after this long.
@export var contact_fade := 45.0
## Position error of a contact seen at the very edge of the sight range.
@export var contact_error := 3.0
## The enemy starts to retake an objective this long after losing it.
@export var counterattack_delay := 60.0
@export var enemy_reinforce_interval := 120.0
@export var enemy_unit_cap := 11
