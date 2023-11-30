import { Component } from '@angular/core';

@Component({
  selector: 'app-team',
  templateUrl: './team.component.html'
})
export class TeamComponent {
	options = [
		{name: 'Repository 1', link: 'https://github.com/Team-1-Code-Name-Placeholder'},
		{name: 'Repository 2', link: 'https://github.com/Team-2-Code-Name-Placeholder'},
		{name: 'Repository 3', link: 'https://github.com/Team-3-Code-Name-Placeholder'},
	];
	value = this.options[0];
	text = ""
	
	email = "sgdfa@gmail.com"

	changeFn() {
		console.log("Focus");
	}
}
