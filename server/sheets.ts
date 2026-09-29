import { google } from 'googleapis';
import { StockScanItem, Timeframe } from '../src/types.js';

/**
 * Creates Google Sheets API client with OAuth token or Service Account credentials.
 */
export function getSheetsClient(authHeader?: string) {
  // If authorization bearer token is supplied in HTTP request header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    return google.sheets({ version: 'v4', auth });
  }

  // Fallback to Google Auth application credentials
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Read table rows from Google Sheet tab (e.g. '30M!A1:F50')
 */
export async function readSheetRows(
  spreadsheetId: string,
  tabName: string,
  authHeader?: string
) {
  try {
    const sheets = getSheetsClient(authHeader);
    const range = `${tabName}!A1:F100`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return {
      success: true,
      values: response.data.values || [],
    };
  } catch (error: any) {
    console.error(`[Google Sheets] Read error for tab ${tabName}:`, error?.message || error);
    return {
      success: false,
      error: error?.message || 'Failed to read Google Sheet tab',
    };
  }
}

/**
 * Pushes scanner rows into the matching Google Sheet tab ('1M', '5M', '10M', '30M')
 * Exact Column order matching user's image:
 * [Stock, Current Price, AI KNN Line, Average Line, Status, Timestamp]
 */
let lastSheetErrorLoggedAt = 0;

export async function updateSheetTab(
  spreadsheetId: string,
  tabName: Timeframe,
  items: StockScanItem[],
  authHeader?: string
) {
  try {
    const sheets = getSheetsClient(authHeader);

    // Format headers and rows to mirror screenshot
    const headers = ['Stock', 'Current Price', 'AI KNN Line', 'Average Line', 'Status', 'Timestamp'];
    const rows = items.map(item => [
      item.stock,
      item.currentPrice,
      item.aiKnnLine,
      item.averageLine,
      item.status,
      item.timestamp
    ]);

    const values = [headers, ...rows];

    // Clear and write updated rows
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tabName}!A1:F200`,
    });

    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1:F${values.length}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return {
      success: true,
      updatedRows: updateResponse.data.updatedRows,
      tab: tabName,
    };
  } catch (error: any) {
    const errorMsg = error?.message || `Failed to update tab ${tabName}`;
    if (Date.now() - lastSheetErrorLoggedAt > 60000) {
      console.warn(`[Google Sheets] Update notice for ${tabName}:`, errorMsg);
      lastSheetErrorLoggedAt = Date.now();
    }
    return {
      success: false,
      error: errorMsg,
      apiDisabled: errorMsg.includes('has not been used') || errorMsg.includes('disabled'),
    };
  }
}

/**
 * Appends audit/client log event to 'Client_Logs' tab
 */
export async function appendClientLogToSheet(
  spreadsheetId: string,
  logLevel: string,
  category: string,
  message: string,
  userName?: string,
  authHeader?: string
) {
  try {
    const sheets = getSheetsClient(authHeader);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: true });
    const values = [[timestamp, logLevel, category, message, userName || 'System']];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `Client_Logs!A1:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
    return { success: true };
  } catch (err: any) {
    // Non-blocking log warning
    return { success: false, error: err?.message };
  }
}

/**
 * Creates a brand new Google Spreadsheet with tabs: '30M', '10M', '5M', '1M', 'Client_Logs'
 */
export async function createNewSpreadsheet(title: string = 'Infinity_Live_Data_Scanner', authHeader?: string) {
  try {
    const sheets = getSheetsClient(authHeader);

    const resource = {
      properties: {
        title,
      },
      sheets: [
        { properties: { title: '30M' } },
        { properties: { title: '10M' } },
        { properties: { title: '5M' } },
        { properties: { title: '1M' } },
        { properties: { title: 'Client_Logs' } },
      ],
    };

    const response = await sheets.spreadsheets.create({
      requestBody: resource,
    });

    const spreadsheetId = response.data.spreadsheetId;
    const spreadsheetUrl = response.data.spreadsheetUrl;

    if (!spreadsheetId) {
      throw new Error('No spreadsheetId returned from Google Sheets API');
    }

    // Set initial headers for stock tabs
    const headers = ['Stock', 'Current Price', 'AI KNN Line', 'Average Line', 'Status', 'Timestamp'];
    const tabs: Timeframe[] = ['30M', '10M', '5M', '1M'];

    for (const tab of tabs) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A1:F1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] },
      });
    }

    // Header for Client_Logs tab
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Client_Logs!A1:E1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Timestamp', 'Level', 'Category', 'Message', 'User']] },
    });

    return {
      success: true,
      spreadsheetId,
      spreadsheetUrl,
      title,
    };
  } catch (error: any) {
    console.error('[Google Sheets] Create error:', error?.message || error);
    return {
      success: false,
      error: error?.message || 'Failed to create new Google Spreadsheet',
    };
  }
}

