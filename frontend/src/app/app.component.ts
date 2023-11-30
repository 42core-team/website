import { Component } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent {
  title = 'CORE';
  showSidenavAndTopbar = true;

  menuItems = [
	{link: '', name: 'Home', icon: 'home'},
	{link: '/battle', name: 'Battle', icon: 'bolt'},
	{link: '/leaderboard', name: 'Leaderboard', icon: 'users'},
	{link: '/team', name: 'Team', icon: 'pencil'},
	{link: '/about', name: 'About', icon: 'info'},
  ]

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {
	this.router.events.subscribe((event: any) => {
	  if (event instanceof NavigationEnd) {
		// Check if the current route has data for showSidenavAndTopbar
		this.showSidenavAndTopbar = this.getShowSidenavAndTopbarFromRouteData(activatedRoute);
	  }
	});
  }

  private getShowSidenavAndTopbarFromRouteData(route: ActivatedRoute): boolean {
	// Traverse the route tree to find showSidenavAndTopbar data
	while (route.firstChild) {
	  route = route.firstChild;
	}
	
	return route.snapshot.data['showSidenavAndTopbar'] !== false;
  }

}
