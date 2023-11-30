import { Component } from '@angular/core';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html'
})
export class LeaderboardComponent {
	teams = [
		{name: 'Team 2', rank: 2},
		{name: 'Team 3', rank: 3},
		{name: 'Team 10', rank: 10},
		{name: 'Team 7', rank: 7},
		{name: 'Team 4', rank: 4},
		{name: 'Team 9', rank: 9},
		{name: 'Team 5', rank: 5},
		{name: 'Team 6', rank: 6},
		{name: 'Team 1', rank: 1},
		{name: 'Team 8', rank: 8},
	]

	constructor() {
		this.teams.sort((a, b) => a.rank - b.rank);
	}
}
