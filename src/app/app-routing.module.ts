import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './view/dashboard/dashboard.component';
import { NotFoundComponent } from './view/not-found/not-found.component';
import { BattleComponent } from './view/battle/battle.component';
import { LeaderboardComponent } from './view/leaderboard/leaderboard.component';
import { AboutComponent } from './view/about/about.component';
import { TeamComponent } from './view/team/team.component';

const routes: Routes = [
	{path: '', component: DashboardComponent},
	{path: 'battle', component: BattleComponent},
	{path: 'leaderboard', component: LeaderboardComponent},
	{path: 'team', component: TeamComponent},

	{path: 'about', component: AboutComponent , data: { showSidenavAndTopbar: false }},
	{path: '**', component: NotFoundComponent , data: { showSidenavAndTopbar: false }}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {

}
