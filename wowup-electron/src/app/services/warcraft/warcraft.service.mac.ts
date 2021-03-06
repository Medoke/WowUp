import { WarcraftServiceImpl } from "./warcraft.service.impl";
import { join } from 'path';
import { FileUtils } from "../../utils/file.utils";
import { WowClientType } from "app/models/warcraft/wow-client-type";

const BLIZZARD_AGENT_PATH = "/Users/Shared/Battle.net/Agent";
const BLIZZARD_PRODUCT_DB_NAME = "product.db";

export class WarcraftServiceMac implements WarcraftServiceImpl {

  public async getBlizzardAgentPath(): Promise<string> {
    const agentPath = join(name, BLIZZARD_AGENT_PATH, BLIZZARD_PRODUCT_DB_NAME);
    const exists = await FileUtils.exists(agentPath)
    return exists ? agentPath : '';
  }

  getExecutableName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return 'World of Warcraft.app';
      case WowClientType.Classic:
        return 'World of Warcraft Classic.app';
      case WowClientType.RetailPtr:
        return 'World of Warcraft Test.app';
      case WowClientType.ClassicPtr:
        return 'World of Warcraft Classic Test.app';
      case WowClientType.Beta:
        return 'World of Warcraft Beta.app';
      default:
        return '';
    }
  }

}