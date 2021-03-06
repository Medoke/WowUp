import { HttpClient } from "@angular/common/http";
import { Addon } from "app/entities/addon";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonDetailsResponse } from "app/models/wow-interface/addon-details-response";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { AddonFolder } from "app/models/wowup/addon-folder";
import { AddonSearchResult } from "app/models/wowup/addon-search-result";
import { PotentialAddon } from "app/models/wowup/potential-addon";
import { ElectronService } from "app/services";
import { CachingService } from "app/services/caching/caching-service";
import { FileService } from "app/services/files/file.service";
import { from, Observable, of } from "rxjs";
import { AddonProvider } from "./addon-provider";
import * as _ from "lodash";
import { AddonSearchResultFile } from "app/models/wowup/addon-search-result-file";
import { map } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import * as CircuitBreaker from "opossum";

const API_URL = "https://api.mmoui.com/v4/game/WOW";
const ADDON_URL = "https://www.wowinterface.com/downloads/info";

export class WowInterfaceAddonProvider implements AddonProvider {
  private readonly _circuitBreaker: CircuitBreaker<
    [addonId: string],
    AddonDetailsResponse
  >;

  public readonly name = "WowInterface";

  constructor(
    private _httpClient: HttpClient,
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _fileService: FileService
  ) {
    this._circuitBreaker = new CircuitBreaker(this.getAddonDetails, {
      resetTimeout: 60000,
    });

    this._circuitBreaker.on("open", () => {
      console.log(`${this.name} circuit breaker open`);
    });
    this._circuitBreaker.on("close", () => {
      console.log(`${this.name} circuit breaker close`);
    });
  }

  async getAll(
    clientType: WowClientType,
    addonIds: string[]
  ): Promise<AddonSearchResult[]> {
    var searchResults: AddonSearchResult[] = [];

    for (let addonId of addonIds) {
      var result = await this.getById(addonId, clientType).toPromise();
      if (result == null) {
        continue;
      }

      searchResults.push(result);
    }

    return searchResults;
  }

  getFeaturedAddons(clientType: WowClientType): Observable<PotentialAddon[]> {
    return of([]);
  }

  async searchByQuery(
    query: string,
    clientType: WowClientType
  ): Promise<PotentialAddon[]> {
    return [];
  }

  async searchByUrl(
    addonUri: URL,
    clientType: WowClientType
  ): Promise<PotentialAddon> {
    const addonId = this.getAddonId(addonUri);
    if (!addonId) {
      throw new Error(`Addon ID not found ${addonUri}`);
    }

    var addon = await this._circuitBreaker.fire(addonId);
    if (addon == null) {
      throw new Error(`Bad addon api response ${addonUri}`);
    }

    return this.toPotentialAddon(addon);
  }

  searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    throw new Error("Method not implemented.");
  }

  getById(
    addonId: string,
    clientType: WowClientType
  ): Observable<AddonSearchResult> {
    return from(this._circuitBreaker.fire(addonId)).pipe(
      map((result) =>
        result ? this.toAddonSearchResult(result, "") : undefined
      )
    );
  }

  isValidAddonUri(addonUri: URL): boolean {
    return addonUri.host && addonUri.host.endsWith("wowinterface.com");
  }

  onPostInstall(addon: Addon): void {
    throw new Error("Method not implemented.");
  }

  async scan(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    for (let addonFolder of addonFolders) {
      if (!addonFolder?.toc?.wowInterfaceId) {
        continue;
      }

      const details = await this._circuitBreaker.fire(
        addonFolder.toc.wowInterfaceId
      );

      addonFolder.matchingAddon = this.toAddon(
        details,
        clientType,
        addonChannelType,
        addonFolder
      );
    }
  }

  private getAddonId(addonUri: URL): string {
    const regex = /\/info(\d+)/i;
    const match = regex.exec(addonUri.pathname);

    return match[1];
  }

  private getAddonDetails = (
    addonId: string
  ): Promise<AddonDetailsResponse> => {
    console.debug('getAddonDetails');
    const url = new URL(`${API_URL}/filedetails/${addonId}.json`);

    return this._httpClient
      .get<AddonDetailsResponse[]>(url.toString())
      .pipe(map((responses) => _.first(responses)))
      .toPromise();
  };

  private getThumbnailUrl(response: AddonDetailsResponse) {
    return _.first(response.images)?.thumbUrl;
  }

  private getAddonUrl(response: AddonDetailsResponse) {
    return `${ADDON_URL}${response.id}`;
  }

  private toAddon(
    response: AddonDetailsResponse,
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolder: AddonFolder
  ): Addon {
    return {
      id: uuidv4(),
      author: response.author,
      autoUpdateEnabled: false,
      channelType: addonChannelType,
      clientType: clientType,
      downloadUrl: response.downloadUri,
      externalId: response.id.toString(),
      externalUrl: this.getAddonUrl(response),
      folderName: addonFolder.name,
      gameVersion: "",
      installedAt: new Date(),
      installedFolders: addonFolder.name,
      installedVersion: addonFolder.toc?.version,
      isIgnored: false,
      latestVersion: response.version,
      name: response.title,
      providerName: this.name,
      thumbnailUrl: this.getThumbnailUrl(response),
    };
  }

  private toPotentialAddon(response: AddonDetailsResponse): PotentialAddon {
    return {
      providerName: this.name,
      name: response.title,
      downloadCount: response.downloads,
      thumbnailUrl: this.getThumbnailUrl(response),
      externalId: response.id.toString(),
      externalUrl: this.getAddonUrl(response),
      author: response.author,
    };
  }

  private toAddonSearchResult(
    response: AddonDetailsResponse,
    folderName: string
  ): AddonSearchResult {
    try {
      var searchResultFile: AddonSearchResultFile = {
        channelType: AddonChannelType.Stable,
        version: response.version,
        downloadUrl: response.downloadUri,
        folders: [folderName],
        gameVersion: "",
        releaseDate: new Date(),
      };

      return {
        author: response.author,
        externalId: response.id.toString(),
        name: response.title,
        thumbnailUrl: this.getThumbnailUrl(response),
        externalUrl: this.getAddonUrl(response),
        providerName: this.name,
        files: [searchResultFile],
      };
    } catch (err) {
      console.error("Failed to create addon search result", err);
      return undefined;
    }
  }
}
