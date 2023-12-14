import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html'
})
export class LoginComponent {
	constructor(private http: HttpClient) {
		this.http.post('http://localhost:8081/auth/login', {"name": "Team 3", "password": "passwor123"}).subscribe(data => {
			console.log(data);
		});
	 }
}
