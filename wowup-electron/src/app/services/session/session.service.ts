import * as _ from "lodash";
import { BehaviorSubject, Subject } from "rxjs";
import { filter, first, map } from "rxjs/operators";

import { Injectable } from "@angular/core";

import { SELECTED_DETAILS_TAB_KEY } from "../../../common/constants";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";

@Injectable({
  providedIn: "root",
})
export class SessionService {
  private readonly _selectedWowInstallationSrc = new BehaviorSubject<WowInstallation>(undefined);
  private readonly _pageContextTextSrc = new BehaviorSubject(""); // right side bar text, context to the screen
  private readonly _statusTextSrc = new BehaviorSubject(""); // left side bar text, context to the app
  private readonly _selectedHomeTabSrc = new BehaviorSubject(0);
  private readonly _autoUpdateCompleteSrc = new BehaviorSubject(0);
  private readonly _addonsChangedSrc = new Subject<boolean>();

  private _selectedDetailTabType: DetailsTabType;

  public readonly selectedWowInstallation$ = this._selectedWowInstallationSrc.asObservable();
  public readonly statusText$ = this._statusTextSrc.asObservable();
  public readonly selectedHomeTab$ = this._selectedHomeTabSrc.asObservable();
  public readonly pageContextText$ = this._pageContextTextSrc.asObservable();
  public readonly autoUpdateComplete$ = this._autoUpdateCompleteSrc.asObservable();
  public readonly addonsChanged$ = this._addonsChangedSrc.asObservable();

  constructor(
    private _warcraftService: WarcraftService,
    private _wowUpService: WowUpService,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _preferenceStorageService: PreferenceStorageService
  ) {
    this._selectedDetailTabType =
      this._preferenceStorageService.getObject<DetailsTabType>(SELECTED_DETAILS_TAB_KEY) || "description";

    // this.loadInitialClientType().pipe(first()).subscribe();

    this._warcraftInstallationService.wowInstallations$
      .pipe(filter((installations) => installations.length > 0))
      .subscribe((installations) => this.onWowInstallationsChange(installations));
  }

  public notifyAddonsChanged(): void {
    this._addonsChangedSrc.next(true);
  }

  public getSelectedDetailsTab(): DetailsTabType {
    return this._selectedDetailTabType;
  }

  public setSelectedDetailsTab(tabType: DetailsTabType) {
    this._selectedDetailTabType = tabType;
    this._preferenceStorageService.set(SELECTED_DETAILS_TAB_KEY, tabType);
  }

  public onWowInstallationsChange(wowInstallations: WowInstallation[]): void {
    if (wowInstallations.length === 0) {
      this.setSelectedWowInstallation(undefined);
      return;
    }

    let selectedInstall = _.find(wowInstallations, (installation) => installation.selected);
    if (!selectedInstall) {
      selectedInstall = _.first(wowInstallations);
      this.setSelectedWowInstallation(selectedInstall.id);
    }

    this._selectedWowInstallationSrc.next(selectedInstall);
  }

  // public onInstalledClientsChange(installedClientTypes: WowClientType[]): void {
  //   if (!installedClientTypes.length) {
  //     this.setSelectedClientType(WowClientType.None);
  //     return;
  //   }

  //   if (
  //     this.getSelectedClientType() !== WowClientType.None &&
  //     installedClientTypes.indexOf(this.getSelectedClientType()) !== -1
  //   ) {
  //     return;
  //   }

  //   this.setSelectedClientType(ldFirst(installedClientTypes));
  // }

  public autoUpdateComplete() {
    this._autoUpdateCompleteSrc.next(Date.now());
  }

  public setContextText(tabIndex: number, text: string) {
    if (tabIndex !== this._selectedHomeTabSrc.value) {
      return;
    }

    this._pageContextTextSrc.next(text);
  }

  public set statusText(text: string) {
    this._statusTextSrc.next(text);
  }

  public getSelectedHomeTab() {
    return this._selectedHomeTabSrc.value;
  }

  public set selectedHomeTab(tabIndex: number) {
    this._pageContextTextSrc.next("");
    this._selectedHomeTabSrc.next(tabIndex);
  }

  // public setSelectedClientType(clientType: WowClientType) {
  //   this._wowUpService.setLastSelectedClientType(clientType);
  //   this._selectedClientTypeSrc.next(clientType);
  // }

  // public getSelectedClientType() {
  //   return this._selectedClientTypeSrc.value;
  // }

  public setSelectedWowInstallation(installationId: string): void {
    if (!installationId) {
      return;
    }

    const installation = this._warcraftInstallationService.getWowInstallation(installationId);
    this._warcraftInstallationService.setSelectedWowInstallation(installation);
    this._selectedWowInstallationSrc.next(installation);
  }

  public getSelectedWowInstallation(): WowInstallation {
    return this._selectedWowInstallationSrc.value;
  }

  // private loadInitialClientType() {
  //   return this._warcraftService.installedClientTypes$.pipe(
  //     filter((clientTypes) => clientTypes !== undefined),
  //     first((installedClientTypes) => installedClientTypes.length > 0),
  //     map((installedClientTypes) => {
  //       console.log("installedClientTypes", installedClientTypes);
  //       const lastSelectedType = this._wowUpService.getLastSelectedClientType();
  //       console.log("lastSelectedType", lastSelectedType);
  //       let initialClientType = installedClientTypes.length ? installedClientTypes[0] : WowClientType.None;

  //       // If the user has no stored type, or the type is no longer found just set it.
  //       if (lastSelectedType == WowClientType.None || !installedClientTypes.some((ct) => ct == lastSelectedType)) {
  //         this._wowUpService.setLastSelectedClientType(initialClientType);
  //       } else {
  //         initialClientType = lastSelectedType;
  //       }

  //       this._selectedClientTypeSrc.next(initialClientType);
  //     })
  //   );
  // }
}
