import { environment } from '../config';
import type { DataService } from './DataService';
import { GoogleSheetsDataService } from './GoogleSheetsDataService';
import { LocalDataService } from './LocalDataService';

export const dataService: DataService = environment.dataProvider === 'google-sheets'
  ? new GoogleSheetsDataService(environment.appsScriptUrl)
  : new LocalDataService();
