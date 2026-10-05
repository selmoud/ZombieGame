class_name BattleRules
extends Resource
## Tunable numbers of a mission. Times are in seconds, distances in cells.

@export var mission_time := 900.0
## Hold this many objectives...
@export var objectives_to_win := 2
## ...for this long without a break to win.
@export var hold_to_win := 180.0
@export var start_funds := 360.0
## Per held objective per second.
@export var income := 1.0
@export var capture_time := 20.0
@export var capture_radius := 2.5
## Delay before a unit bought after the start arrives.
@export var arrival_delay := 15.0
@export var strike_cost := 60.0
@export var strike_delay := 8.0
@export var strike_radius := 2.5
@export var strike_scatter := 1.5
## Share of full strength lost by a unit in the open inside the strike.
@export var strike_damage_min := 0.3
@export var strike_damage_max := 0.7
## Strength lost per second by a target of a full-strength unit with firepower 1.
@export var damage_rate := 0.2
## A unit weaker than this share of full strength pulls back when hit.
@export var retreat_threshold := 0.3
## A contact nobody sees any more disappears after this long.
@export var contact_fade := 45.0
## Position error of a contact seen at the very edge of the sight range.
@export var contact_error := 3.0
## The enemy starts to retake an objective this long after losing it.
@export var counterattack_delay := 30.0
@export var enemy_reinforce_interval := 100.0
@export var enemy_unit_cap := 7
