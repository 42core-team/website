import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DashboardComponent } from './view/dashboard/dashboard.component';
import { NotFoundComponent } from './view/not-found/not-found.component';
import { BattleComponent } from './view/battle/battle.component';
import { LeaderboardComponent } from './view/leaderboard/leaderboard.component';
import { AboutComponent } from './view/about/about.component';
import { TableModule } from 'primeng/table';
import { TeamComponent } from './view/team/team.component';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { FileUploadModule } from 'primeng/fileupload';
import { InputSwitchModule } from 'primeng/inputswitch';
import { EditorModule } from 'primeng/editor';
import { DividerModule } from 'primeng/divider';


@NgModule({
  declarations: [
	AppComponent,
 	DashboardComponent,
	NotFoundComponent,
	BattleComponent,
	LeaderboardComponent,
	AboutComponent,
	TeamComponent,
  ],
  imports: [
	BrowserModule,
	BrowserAnimationsModule,
	AppRoutingModule,
	CardModule,
	ButtonModule,
	TableModule,
	InputTextModule,
	DropdownModule,
	FormsModule,
	FileUploadModule,
	InputSwitchModule,
	EditorModule,
	DividerModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
