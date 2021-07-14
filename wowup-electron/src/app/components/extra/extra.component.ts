import * as _ from "lodash";
import { BehaviorSubject, from } from "rxjs";
import { debounceTime, filter, first, map } from "rxjs/operators";

import { Component, Input, OnDestroy, OnInit } from "@angular/core";

import { ElectronService } from "../../services";
import { SessionService } from "../../services/session/session.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WtfService } from "../../services/wtf/wtf.service";
import { removeExtension } from "../../utils/string.utils";
import { AddonFolder } from "../../models/wowup/addon-folder";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";

interface SavedVariable {
  name: string;
  size: number;
  hasAddon: boolean;
}

interface Server {
  name: string;
  size: number;
  sizeMb: string;
  characters: Character[];
}

interface Character {
  name: string;
  size: number;
  sizeMb: string;
  variables: SavedVariable[];
}

interface AccountItem {
  name: string;
  globalVariables: SavedVariable[];
  servers: Server[];
  size: number;
  sizeMb: string;
}

@Component({
  selector: "app-extra",
  templateUrl: "./extra.component.html",
  styleUrls: ["./extra.component.scss"],
})
export class ExtraComponent implements OnInit, OnDestroy {
  @Input("tabIndex") public tabIndex!: number;

  @Input()
  public get active(): boolean {
    return this._active;
  }
  public set active(active: boolean) {
    this._active = active;
    if (this._active) {
      this.lazyLoad();
    }
  }
  private _active = false;

  public accountMap = new BehaviorSubject<AccountItem[]>([]);
  public loading$ = new BehaviorSubject<boolean>(false);
  public error$ = new BehaviorSubject<string>("");
  public installations: WowInstallation[] = [];
  public selectedInstallationId = "";

  public get selectedInstallationLabel(): string {
    return this.installations.find((inst) => inst.id === this.selectedInstallationId)?.label ?? "";
  }

  public constructor(
    public electronService: ElectronService,
    private _warcraftService: WarcraftService,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _wtfService: WtfService
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {}

  public onClientChange(): void {
    const installation = this.installations.find((inst) => inst.id === this.selectedInstallationId);
    from(this.loadAccounts(installation))
      .pipe(first())
      .subscribe((accounts) => {
        this.accountMap.next(accounts);
      });
  }

  private lazyLoad() {
    console.debug("lazyLoad");
    this.loading$.next(true);
    this.error$.next("");
    this.installations = this._warcraftInstallationService.getWowInstallations();
    this.selectedInstallationId = this.installations[0]?.id ?? "";

    from(this.loadAccounts(this.installations[0]))
      .pipe(first())
      .subscribe((accounts) => {
        this.accountMap.next(accounts);
      });
  }

  private async loadAccounts(installation: WowInstallation): Promise<AccountItem[]> {
    try {
      if (!installation) {
        return [];
      }

      const accounts = await this._wtfService.getAccounts(installation);
      const addonFolders = await this._warcraftService.listAddons(installation);
      console.log("addonFolders", addonFolders);

      const accountMap: AccountItem[] = [];
      for (const account of accounts) {
        const accountGlobalVars = await this.getAccountGlobalVars(installation, account, addonFolders);
        const serverList = await this.getServers(installation, account, addonFolders);
        console.debug("serverList", serverList);

        const totalSize = _.sumBy(accountGlobalVars, (gvar) => gvar.size);
        accountMap.push({
          globalVariables: accountGlobalVars,
          name: account,
          size: totalSize,
          sizeMb: (totalSize / 1024 / 1024).toFixed(2),
          servers: serverList,
        });
      }

      return accountMap;
    } catch (e) {
      console.error(e);
      this.error$.next(e.message);
      return [];
    } finally {
      this.loading$.next(false);
    }
  }

  private async getAccountGlobalVars(
    installation: WowInstallation,
    account: string,
    addonFolders: AddonFolder[]
  ): Promise<SavedVariable[]> {
    const globalVariables = await this._wtfService.getGlobalVariables(installation, account);
    console.debug("globalVariables", globalVariables);
    const gVars: SavedVariable[] = globalVariables.map((gv) => {
      return {
        hasAddon: addonFolders.some((af) => af.name === removeExtension(gv.name)),
        name: gv.name,
        size: gv.stats.size,
      };
    });

    return gVars;
  }

  private async getServers(
    installation: WowInstallation,
    account: string,
    addonFolders: AddonFolder[]
  ): Promise<Server[]> {
    const serverNames = await this._wtfService.getServers(installation, account);
    const servers: Server[] = serverNames.map((server) => {
      return {
        name: server,
        characters: [],
        size: 0,
        sizeMb: "",
      };
    });

    for (const server of servers) {
      const charNames = await this._wtfService.getCharacters(installation, account, server.name);
      const chars: Character[] = [];
      for (const charName of charNames) {
        const variables = await this.getCharacterSavedVariables(
          installation,
          account,
          server.name,
          charName,
          addonFolders
        );
        const totalSize = _.sumBy(variables, (svar) => svar.size);

        chars.push({
          name: charName,
          size: totalSize,
          sizeMb: (totalSize / 1024 / 1025).toFixed(2),
          variables,
        });
      }

      server.characters = chars;
      server.size = _.sumBy(server.characters, (char) => char.size);
      server.sizeMb = (server.size / 1024 / 1024).toFixed(2);
    }

    return servers;
  }

  private async getCharacterSavedVariables(
    installation: WowInstallation,
    account: string,
    server: string,
    character: string,
    addonFolders: AddonFolder[]
  ): Promise<SavedVariable[]> {
    const savedVars = await this._wtfService.getCharacterVariables(installation, account, server, character);

    const vars: SavedVariable[] = savedVars.map((gv) => {
      return {
        hasAddon: addonFolders.some((af) => af.name === removeExtension(gv.name)),
        name: gv.name,
        size: gv.stats.size,
      };
    });

    return vars;
  }
}