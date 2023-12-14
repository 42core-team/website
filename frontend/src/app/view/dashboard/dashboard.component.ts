import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
	constructor(private http: HttpClient) {
		this.http.get('http://localhost:8081/team', {withCredentials: true}).subscribe(data => {
			console.log(data);
		});
	 }
}
