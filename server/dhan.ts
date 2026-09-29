import axios from 'axios';
import { Candle } from './indicators.js';
import { Timeframe } from '../src/types.js';

export interface StockMaster {
  symbol: string;
  name: string;
  basePrice: number;
  securityId?: string;
}

export const STOCK_LIST: StockMaster[] = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", basePrice: 1327.3 },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd", basePrice: 2425.7 },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", basePrice: 731 },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", basePrice: 1431.8 },
  { symbol: "INFY", name: "Infosys Ltd", basePrice: 1183 },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", basePrice: 1943 },
  { symbol: "SBIN", name: "State Bank of India", basePrice: 1071 },
  { symbol: "LTIM", name: "LTIMindtree Ltd", basePrice: 5450 },
  { symbol: "ITC", name: "ITC Ltd", basePrice: 282.65 },
  { symbol: "LT", name: "Larsen & Toubro Ltd", basePrice: 4080 },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd", basePrice: 2087.2 },
  { symbol: "ADANIENT", name: "Adani Enterprises Ltd", basePrice: 3010 },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", basePrice: 1020.4 },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", basePrice: 1102.2 },
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd", basePrice: 14097 },
  { symbol: "M&M", name: "Mahindra & Mahindra Ltd", basePrice: 3517 },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries", basePrice: 1944.4 },
  { symbol: "HCLTECH", name: "HCL Technologies Ltd", basePrice: 1357.2 },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd", basePrice: 393.5 },
  { symbol: "TITAN", name: "Titan Company Ltd", basePrice: 5090 },
  { symbol: "NTPC", name: "NTPC Ltd", basePrice: 340.45 },
  { symbol: "AXISBANK", name: "Axis Bank Ltd", basePrice: 1247.3 },
  { symbol: "ONGC", name: "Oil & Natural Gas Corp Ltd", basePrice: 239.84 },
  { symbol: "ADANIPORTS", name: "Adani Ports & SEZ Ltd", basePrice: 1681 },
  { symbol: "POWERGRID", name: "Power Grid Corp of India Ltd", basePrice: 270.1 },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd", basePrice: 190.24 },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd", basePrice: 12038 },
  { symbol: "COALINDIA", name: "Coal India Ltd", basePrice: 411 },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd", basePrice: 2750 },
  { symbol: "TRENT", name: "Trent Ltd", basePrice: 3025 },
  { symbol: "BEL", name: "Bharat Electronics Ltd", basePrice: 404.35 },
  { symbol: "HAL", name: "Hindustan Aeronautics Ltd", basePrice: 4928 },
  { symbol: "VBL", name: "Varun Beverages Ltd", basePrice: 445.5 },
  { symbol: "DLF", name: "DLF Ltd", basePrice: 660 },
  { symbol: "DIVISLAB", name: "Divis Laboratories Ltd", basePrice: 8300 },
  { symbol: "GRASIM", name: "Grasim Industries Ltd", basePrice: 3380.5 },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd", basePrice: 1302 },
  { symbol: "SIEMENS", name: "Siemens Ltd", basePrice: 3914.3 },
  { symbol: "IOC", name: "Indian Oil Corp Ltd", basePrice: 142 },
  { symbol: "PIDILITIND", name: "Pidilite Industries Ltd", basePrice: 1685 },
  { symbol: "SBILIFE", name: "SBI Life Insurance Co Ltd", basePrice: 1855 },
  { symbol: "ABB", name: "ABB India Ltd", basePrice: 7649.5 },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance Co Ltd", basePrice: 540 },
  { symbol: "GAIL", name: "GAIL India Ltd", basePrice: 172.5 },
  { symbol: "CHOLAFIN", name: "Cholamandalam Inv & Fin", basePrice: 1920 },
  { symbol: "INDIGO", name: "InterGlobe Aviation Ltd", basePrice: 5333.5 },
  { symbol: "TECHM", name: "Tech Mahindra Ltd", basePrice: 1640 },
  { symbol: "HINDALCO", name: "Hindalco Industries Ltd", basePrice: 1054.05 },
  { symbol: "EICHERMOT", name: "Eicher Motors Ltd", basePrice: 7975 },
  { symbol: "DRREDDY", name: "Dr Reddys Laboratories Ltd", basePrice: 1158.8 },
  { symbol: "POLYCAB", name: "Polycab India Ltd", basePrice: 9275 },
  { symbol: "CIPLA", name: "Cipla Ltd", basePrice: 1467.7 },
  { symbol: "AMBUJACEM", name: "Ambuja Cements Ltd", basePrice: 430.85 },
  { symbol: "WIPRO", name: "Wipro Ltd", basePrice: 185.5 },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto Ltd", basePrice: 11677 },
  { symbol: "MUTHOOTFIN", name: "Muthoot Finance Ltd", basePrice: 2906 },
  { symbol: "JIOFIN", name: "Jio Financial Services Ltd", basePrice: 254 },
  { symbol: "MAXHEALTH", name: "Max Healthcare Institute", basePrice: 1069 },
  { symbol: "TATAPOWER", name: "Tata Power Company Ltd", basePrice: 382 },
  { symbol: "REC", name: "REC Ltd", basePrice: 343.75 },
  { symbol: "PFC", name: "Power Finance Corp Ltd", basePrice: 385.15 },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd", basePrice: 5860 },
  { symbol: "SHRIRAMFIN", name: "Shriram Finance Ltd", basePrice: 152.06 },
  { symbol: "MOTHERSON", name: "Samvardhana Motherson Int", basePrice: 167.99 },
  { symbol: "TVSMOTOR", name: "TVS Motor Company Ltd", basePrice: 4466.2 },
  { symbol: "DABUR", name: "Dabur India Ltd", basePrice: 414.2 },
  { symbol: "VEDL", name: "Vedanta Ltd", basePrice: 283.65 },
  { symbol: "TORNTPHARM", name: "Torrent Pharmaceuticals Ltd", basePrice: 4924 },
  { symbol: "TATAELXSI", name: "Tata Elxsi Ltd", basePrice: 3808 },
  { symbol: "PERSISTENT", name: "Persistent Systems Ltd", basePrice: 5474 },
  { symbol: "COFORGE", name: "Coforge Ltd", basePrice: 1810 },
  { symbol: "MCX", name: "Multi Commodity Exchange", basePrice: 2759.3 },
  { symbol: "NAUKRI", name: "Info Edge India Ltd", basePrice: 1282 },
  { symbol: "ZOMATO", name: "Zomato Ltd", basePrice: 235 },
  { symbol: "TATACOMM", name: "Tata Communications Ltd", basePrice: 1739.4 },
  { symbol: "DIXON", name: "Dixon Technologies Ltd", basePrice: 14115 },
  { symbol: "BHEL", name: "Bharat Heavy Electricals Ltd", basePrice: 409 },
  { symbol: "CANBK", name: "Canara Bank", basePrice: 129 },
  { symbol: "PNB", name: "Punjab National Bank", basePrice: 113.5 },
  { symbol: "BANKBARODA", name: "Bank of Baroda", basePrice: 247.81 },
  { symbol: "LICI", name: "Life Insurance Corp of India", basePrice: 393 },
  { symbol: "BPCL", name: "Bharat Petroleum Corp Ltd", basePrice: 318.5 },
  { symbol: "ICICIPRULI", name: "ICICI Prudential Life", basePrice: 499.75 },
  { symbol: "ICICIGI", name: "ICICI Lombard General Ins", basePrice: 1648.8 },
  { symbol: "INDHOTEL", name: "Indian Hotels Co Ltd", basePrice: 728.7 },
  { symbol: "LODHA", name: "Macrotech Developers Ltd", basePrice: 1213 },
  { symbol: "COLPAL", name: "Colgate-Palmolive India", basePrice: 2019.5 },
  { symbol: "MARICO", name: "Marico Ltd", basePrice: 863.5 },
  { symbol: "BERGEPAINT", name: "Berger Paints India Ltd", basePrice: 542.1 },
  { symbol: "GODREJCP", name: "Godrej Consumer Products", basePrice: 1033 },
  { symbol: "HAVELLS", name: "Havells India Ltd", basePrice: 1285 },
  { symbol: "SRF", name: "SRF Ltd", basePrice: 2610 },
  { symbol: "BOSCHLTD", name: "Bosch Ltd", basePrice: 43505 },
  { symbol: "CUMMINSIND", name: "Cummins India Ltd", basePrice: 5448 },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals Ltd", basePrice: 8912 },
  { symbol: "LUPIN", name: "Lupin Ltd", basePrice: 2300 },
  { symbol: "AUROPHARMA", name: "Aurobindo Pharma Ltd", basePrice: 1648 },
  { symbol: "ALKEM", name: "Alkem Laboratories Ltd", basePrice: 5598.5 },
  { symbol: "SYNGENE", name: "Syngene International Ltd", basePrice: 402.6 },
  { symbol: "MANKIND", name: "Mankind Pharma Ltd", basePrice: 2438 },
  { symbol: "AARTIIND", name: "Aarti Industries Ltd", basePrice: 500.55 },
  { symbol: "ABCAPITAL", name: "Aditya Birla Capital Ltd", basePrice: 407.75 },
  { symbol: "ABFRL", name: "Aditya Birla Fashion & Retail", basePrice: 61.04 },
  { symbol: "ACC", name: "ACC Ltd", basePrice: 1357.6 },
  { symbol: "ADANIENSOL", name: "Adani Energy Solutions Ltd", basePrice: 1632 },
  { symbol: "ADANIGREEN", name: "Adani Green Energy Ltd", basePrice: 1369 },
  { symbol: "ADANITRANS", name: "Adani Transmission Ltd", basePrice: 980 },
  { symbol: "ADANIWILMAR", name: "Adani Wilmar Ltd", basePrice: 345 },
  { symbol: "ASTRAL", name: "Astral Ltd", basePrice: 1437 },
  { symbol: "ATGL", name: "Adani Total Gas Ltd", basePrice: 660.1 },
  { symbol: "AUBANK", name: "AU Small Finance Bank Ltd", basePrice: 1068 },
  { symbol: "BALKRISIND", name: "Balkrishna Industries Ltd", basePrice: 2524.6 },
  { symbol: "BANDHANBNK", name: "Bandhan Bank Ltd", basePrice: 172.62 },
  { symbol: "BATAINDIA", name: "Bata India Ltd", basePrice: 712.85 },
  { symbol: "BHARATFORG", name: "Bharat Forge Ltd", basePrice: 2093.1 },
  { symbol: "BIOCON", name: "Biocon Ltd", basePrice: 426.1 },
  { symbol: "BSOFT", name: "Birlasoft Ltd", basePrice: 317.25 },
  { symbol: "CENTURYTEX", name: "Century Textiles & Ind", basePrice: 2280 },
  { symbol: "CESC", name: "CESC Ltd", basePrice: 164.58 },
  { symbol: "CGPOWER", name: "CG Power & Industrial Sol", basePrice: 879 },
  { symbol: "CHAMBLFERT", name: "Chambal Fertilisers & Chem", basePrice: 451.55 },
  { symbol: "COROMANDEL", name: "Coromandel International Ltd", basePrice: 2098.3 },
  { symbol: "CROMPTON", name: "Crompton Greaves Consumer", basePrice: 247.55 },
  { symbol: "CYIENT", name: "Cyient Ltd", basePrice: 855 },
  { symbol: "DEEPAKNTR", name: "Deepak Nitrite Ltd", basePrice: 1779.2 },
  { symbol: "DELHIVERY", name: "Delhivery Ltd", basePrice: 478.35 },
  { symbol: "ESCORTS", name: "Escorts Kubota Ltd", basePrice: 3082.1 },
  { symbol: "EXIDEIND", name: "Exide Industries Ltd", basePrice: 485.4 },
  { symbol: "FEDERALBNK", name: "Federal Bank Ltd", basePrice: 358.35 },
  { symbol: "FACT", name: "Fertilisers & Chemicals Travancore", basePrice: 834.7 },
  { symbol: "FORTIS", name: "Fortis Healthcare Ltd", basePrice: 945.15 },
  { symbol: "GMRAIRPORT", name: "GMR Airports Infrastructure", basePrice: 106.3 },
  { symbol: "GNFC", name: "Gujarat Narmada Valley Fert", basePrice: 544.1 },
  { symbol: "GODREJPROP", name: "Godrej Properties Ltd", basePrice: 2108.4 },
  { symbol: "GSPL", name: "Gujarat State Petronet Ltd", basePrice: 277 },
  { symbol: "GUJGASLTD", name: "Gujarat Gas Ltd", basePrice: 327.05 },
  { symbol: "HAPPSTMNDS", name: "Happiest Minds Technologies", basePrice: 401.8 },
  { symbol: "HINDPETRO", name: "Hindustan Petroleum Corp", basePrice: 393.15 },
  { symbol: "HINDZINC", name: "Hindustan Zinc Ltd", basePrice: 595.15 },
  { symbol: "HUDCO", name: "Housing & Urban Development", basePrice: 199.61 },
  { symbol: "IDFCFIRSTB", name: "IDFC First Bank Ltd", basePrice: 85.1 },
  { symbol: "IEX", name: "Indian Energy Exchange Ltd", basePrice: 126.3 },
  { symbol: "IGL", name: "Indraprastha Gas Ltd", basePrice: 152.15 },
  { symbol: "INDUSTOWER", name: "Indus Towers Ltd", basePrice: 368 },
  { symbol: "INTELLECT", name: "Intellect Design Arena Ltd", basePrice: 727.85 },
  { symbol: "IPCALAB", name: "IPCA Laboratories Ltd", basePrice: 1685.8 },
  { symbol: "IRCTC", name: "Indian Railway Catering & Tourism", basePrice: 522.25 },
  { symbol: "IRFC", name: "Indian Railway Finance Corp", basePrice: 88.5 },
  { symbol: "IREDA", name: "Indian Renewable Energy Dev", basePrice: 120 },
  { symbol: "JINDALSTEL", name: "Jindal Steel & Power Ltd", basePrice: 1125 },
  { symbol: "JUBLFOOD", name: "Jubilant FoodWorks Ltd", basePrice: 495 },
  { symbol: "KALYANKJIL", name: "Kalyan Jewellers India", basePrice: 600.25 },
  { symbol: "KEI", name: "KEI Industries Ltd", basePrice: 5659.8 },
  { symbol: "KIOCL", name: "KIOCL Ltd", basePrice: 393.1 },
  { symbol: "KPITTECH", name: "KPIT Technologies Ltd", basePrice: 627.9 },
  { symbol: "LAURUSLABS", name: "Laurus Labs Ltd", basePrice: 1854 },
  { symbol: "LICHSGFIN", name: "LIC Housing Finance Ltd", basePrice: 500 },
  { symbol: "LTF", name: "L&T Finance Ltd", basePrice: 312.85 },
  { symbol: "LTTS", name: "L&T Technology Services", basePrice: 3583.4 },
  { symbol: "MFSL", name: "Max Financial Services", basePrice: 1514.5 },
  { symbol: "MGL", name: "Mahanagar Gas Ltd", basePrice: 1123.6 },
  { symbol: "MPHASIS", name: "Mphasis Ltd", basePrice: 2508 },
  { symbol: "MRF", name: "MRF Ltd", basePrice: 133850 },
  { symbol: "NATIONALUM", name: "National Aluminium Co Ltd", basePrice: 382.7 },
  { symbol: "NAVINFLUOR", name: "Navin Fluorine International", basePrice: 8196.5 },
  { symbol: "NMDC", name: "NMDC Ltd", basePrice: 85.48 },
  { symbol: "OBEROIRLTY", name: "Oberoi Realty Ltd", basePrice: 1793 },
  { symbol: "OFSS", name: "Oracle Financial Services", basePrice: 11890 },
  { symbol: "OIL", name: "Oil India Ltd", basePrice: 453 },
  { symbol: "PAYTM", name: "One 97 Communications Ltd", basePrice: 1584.1 },
  { symbol: "PEL", name: "Piramal Enterprises Ltd", basePrice: 960 },
  { symbol: "PETRONET", name: "Petronet LNG Ltd", basePrice: 280 },
  { symbol: "PHOENIXLTD", name: "Phoenix Mills Ltd", basePrice: 1935 },
  { symbol: "PIIND", name: "PI Industries Ltd", basePrice: 2751.6 },
  { symbol: "PVRINOX", name: "PVR INOX Ltd", basePrice: 1144 },
  { symbol: "RAMCOCEM", name: "Ramco Cements Ltd", basePrice: 953.75 },
  { symbol: "RCF", name: "Rashtriya Chemicals & Fert", basePrice: 127.2 },
  { symbol: "SAIL", name: "Steel Authority of India Ltd", basePrice: 172.45 },
  { symbol: "SANGHVIMOV", name: "Sanghvi Movers Ltd", basePrice: 511.4 },
  { symbol: "SBICARD", name: "SBI Cards and Payment Services", basePrice: 655 },
  { symbol: "SCHAEFFLER", name: "Schaeffler India Ltd", basePrice: 4063.2 },
  { symbol: "SONACOMS", name: "Sona BLW Precision Forgings", basePrice: 812.5 },
  { symbol: "SUNTV", name: "Sun TV Network Ltd", basePrice: 487.8 },
  { symbol: "SUPREMEIND", name: "Supreme Industries Ltd", basePrice: 3495 },
  { symbol: "SUZLON", name: "Suzlon Energy Ltd", basePrice: 47.5 },
  { symbol: "TATACHEM", name: "Tata Chemicals Ltd", basePrice: 668.9 },
  { symbol: "TATACONSUM", name: "Tata Consumer Products Ltd", basePrice: 1108.7 },
  { symbol: "TATAMTRDVR", name: "Tata Motors DVR", basePrice: 347.1 },
  { symbol: "TATATECH", name: "Tata Technologies Ltd", basePrice: 879.15 },
  { symbol: "TIINDIA", name: "Tube Investments of India", basePrice: 2815 },
  { symbol: "TORNTPOWER", name: "Torrent Power Ltd", basePrice: 1342.9 },
  { symbol: "TNC", name: "Tata NYK Transport", basePrice: 450 },
  { symbol: "UPL", name: "UPL Ltd", basePrice: 567 },
  { symbol: "VOLTAS", name: "Voltas Ltd", basePrice: 1267.9 },
  { symbol: "ZEEL", name: "Zee Entertainment Enterprises", basePrice: 94.42 },
  { symbol: "ZYDUSLIFE", name: "Zydus Lifesciences Ltd", basePrice: 1119 },
  { symbol: "3MINDIA", name: "3M India Ltd", basePrice: 35900 },
  { symbol: "AIAENG", name: "AIA Engineering Ltd", basePrice: 4790.3 },
  { symbol: "AJANTPHARM", name: "Ajanta Pharma Ltd", basePrice: 3506.2 },
  { symbol: "APLLTD", name: "Alembic Pharmaceuticals", basePrice: 831.35 },
  { symbol: "ALKYLAMINE", name: "Alkyl Amines Chemicals Ltd", basePrice: 1916.4 },
  { symbol: "AMATA", name: "Amara Raja Energy & Mobility", basePrice: 897.7 },
  { symbol: "ANGELONE", name: "Angel One Ltd", basePrice: 294.8 },
  { symbol: "APARINDS", name: "Apar Industries Ltd", basePrice: 16448 },
  { symbol: "APLAPOLLO", name: "APL Apollo Tubes Ltd", basePrice: 2020 },
  { symbol: "ASAHIINDIA", name: "Asahi India Glass Ltd", basePrice: 902.9 },
  { symbol: "ASHOKLEY", name: "Ashok Leyland Ltd", basePrice: 174 },
  { symbol: "ASTERDM", name: "Aster DM Healthcare Ltd", basePrice: 867.15 },
  { symbol: "ATUL", name: "Atul Ltd", basePrice: 6854 },
  { symbol: "AVANTIFEED", name: "Avanti Feeds Ltd", basePrice: 903.75 },
  { symbol: "BAJAJHLDNG", name: "Bajaj Holdings & Inv", basePrice: 11471 },
  { symbol: "BALRAMCHIN", name: "Balrampur Chini Mills", basePrice: 655.25 },
  { symbol: "BANKINDIA", name: "Bank of India", basePrice: 141 },
  { symbol: "BEML", name: "BEML Ltd", basePrice: 1884.4 },
  { symbol: "BHARATDYNA", name: "Bharat Dynamics Ltd", basePrice: 1310 },
  { symbol: "BBL", name: "Bharat Bijlee Ltd", basePrice: 2299.5 },
  { symbol: "BLUESTARCO", name: "Blue Star Ltd", basePrice: 1508 },
  { symbol: "BRIGADE", name: "Brigade Enterprises Ltd", basePrice: 607.7 },
  { symbol: "BRITANNIA", name: "Britannia Industries Ltd", basePrice: 5623.5 },
  { symbol: "CAMPUS", name: "Campus Activewear Ltd", basePrice: 222.07 },
  { symbol: "CAMS", name: "Computer Age Management Sol", basePrice: 789.45 },
  { symbol: "CARBORUNIV", name: "Carborundum Universal Ltd", basePrice: 1121 },
  { symbol: "CASTROLIND", name: "Castrol India Ltd", basePrice: 193.43 },
  { symbol: "CDSL", name: "Central Depository Services", basePrice: 1332.5 },
  { symbol: "CEATLTD", name: "CEAT Ltd", basePrice: 3793.6 },
  { symbol: "CENTRALBK", name: "Central Bank of India", basePrice: 31.02 },
  { symbol: "CENTURYPLY", name: "Century Plyboards India", basePrice: 779.55 },
  { symbol: "CHALET", name: "Chalet Hotels Ltd", basePrice: 837.1 },
  { symbol: "CHEMCON", name: "Chemcon Speciality Chem", basePrice: 191.59 },
  { symbol: "CLEAN", name: "Clean Science & Tech", basePrice: 803.55 },
  { symbol: "COCHINSHIP", name: "Cochin Shipyard Ltd", basePrice: 1502 },
  { symbol: "CONCOR", name: "Container Corp of India", basePrice: 501.9 },
  { symbol: "CREDITACC", name: "CreditAccess Grameen Ltd", basePrice: 1530.5 },
  { symbol: "CRISIL", name: "CRISIL Ltd", basePrice: 4480.8 },
  { symbol: "CUB", name: "City Union Bank Ltd", basePrice: 216.42 },
  { symbol: "DATAPATTNS", name: "Data Patterns India Ltd", basePrice: 4429.7 },
  { symbol: "DCMSHRIRAM", name: "DCM Shriram Ltd", basePrice: 1016 },
  { symbol: "DEEPAKFERT", name: "Deepak Fertilisers & Petro", basePrice: 1530.4 },
  { symbol: "DEVYANI", name: "Devyani International Ltd", basePrice: 133.56 },
  { symbol: "EIDPARRY", name: "EID Parry India Ltd", basePrice: 791.25 },
  { symbol: "EIHOTEL", name: "EIH Ltd (Oberoi Hotels)", basePrice: 303.15 },
  { symbol: "ELGIEQUIP", name: "Elgi Equipments Ltd", basePrice: 582.55 },
  { symbol: "EMAMILTD", name: "Emami Ltd", basePrice: 409.5 },
  { symbol: "ENDURANCE", name: "Endurance Technologies Ltd", basePrice: 2969 },
  { symbol: "ENGINERSIN", name: "Engineers India Ltd", basePrice: 247.96 },
  { symbol: "EQUITASBNK", name: "Equitas Small Finance Bank", basePrice: 74.78 },
  { symbol: "ERIS", name: "Eris Lifesciences Ltd", basePrice: 1393.4 },
  { symbol: "ESABINDIA", name: "ESAB India Ltd", basePrice: 5746 },
  { symbol: "FINCABLES", name: "Finolex Cables Ltd", basePrice: 1058.05 },
  { symbol: "FINEORG", name: "Fine Organic Industries", basePrice: 5027.8 },
  { symbol: "FINPIPE", name: "Finolex Industries Ltd", basePrice: 161.33 },
  { symbol: "FSL", name: "Firstsource Solutions Ltd", basePrice: 279.7 },
  { symbol: "GLENMARK", name: "Glenmark Pharmaceuticals", basePrice: 2251.3 },
  { symbol: "GLS", name: "Glenmark Life Sciences", basePrice: 870 },
  { symbol: "GODFRYPHLP", name: "Godfrey Phillips India", basePrice: 2289 },
  { symbol: "GODREJIND", name: "Godrej Industries Ltd", basePrice: 1292.2 },
  { symbol: "GRAVITA", name: "Gravita India Ltd", basePrice: 1783.5 },
  { symbol: "GRINDWELL", name: "Grindwell Norton Ltd", basePrice: 2116.5 },
  { symbol: "GSFC", name: "Gujarat State Fertilizers", basePrice: 161.65 },
  { symbol: "HFCL", name: "HFCL Ltd", basePrice: 212.97 },
  { symbol: "HLEGLAS", name: "HLE Glascoat Ltd", basePrice: 474.5 },
  { symbol: "HONAUT", name: "Honeywell Automation India", basePrice: 38035 },
  { symbol: "IBREALEST", name: "Indiabulls Real Estate", basePrice: 131.55 },
  { symbol: "IDBI", name: "IDBI Bank Ltd", basePrice: 83 },
  { symbol: "IDEA", name: "Vodafone Idea Ltd", basePrice: 12.92 },
  { symbol: "IIFL", name: "IIFL Finance Ltd", basePrice: 625.9 },
  { symbol: "INDIAMART", name: "IndiaMART InterMESH Ltd", basePrice: 1782.7 },
  { symbol: "INDIANB", name: "Indian Bank", basePrice: 884.15 },
  { symbol: "IOB", name: "Indian Overseas Bank", basePrice: 33.88 },
  { symbol: "IRB", name: "IRB Infrastructure Dev", basePrice: 19.52 },
  { symbol: "IRCON", name: "Ircon International Ltd", basePrice: 130.01 },
  { symbol: "ISEC", name: "ICICI Securities Ltd", basePrice: 840 },
  { symbol: "ITI", name: "ITI Ltd", basePrice: 286 },
  { symbol: "J&KBANK", name: "Jammu & Kashmir Bank", basePrice: 155.15 },
  { symbol: "JBCHEPHARM", name: "JB Chemicals & Pharma", basePrice: 2416.1 },
  { symbol: "JINDALSAW", name: "Jindal Saw Ltd", basePrice: 279.05 },
  { symbol: "JSL", name: "Jindal Stainless Ltd", basePrice: 732.75 },
  { symbol: "JUSTDIAL", name: "Just Dial Ltd", basePrice: 687.55 },
  { symbol: "JYOTHYLAB", name: "Jyothy Labs Ltd", basePrice: 205.44 },
  { symbol: "KAJARIACER", name: "Kajaria Ceramics Ltd", basePrice: 1184.7 },
  { symbol: "KALPATPOWR", name: "Kalpataru Projects Int", basePrice: 1315.4 },
  { symbol: "KANSAINER", name: "Kansai Nerolac Paints", basePrice: 215.65 },
  { symbol: "KARURVYSYA", name: "Karur Vysya Bank Ltd", basePrice: 331.2 },
  { symbol: "KEC", name: "KEC International Ltd", basePrice: 475.85 },
  { symbol: "KFINTECH", name: "KFin Technologies Ltd", basePrice: 928.5 },
  { symbol: "KIRLOSENG", name: "Kirloskar Oil Engines", basePrice: 2131.2 },
  { symbol: "KNRCON", name: "KNR Constructions Ltd", basePrice: 142.69 },
  { symbol: "KPIL", name: "Kalpataru Projects Int", basePrice: 1315.4 },
  { symbol: "KPRMILL", name: "KPR Mill Ltd", basePrice: 1086 },
  { symbol: "KRBL", name: "KRBL Ltd", basePrice: 373.9 },
  { symbol: "LALPATHLAB", name: "Dr Lal PathLabs Ltd", basePrice: 1954 },
  { symbol: "LATENTVIEW", name: "Latent View Analytics", basePrice: 297.8 },
  { symbol: "LEMONTREE", name: "Lemon Tree Hotels Ltd", basePrice: 107.94 },
  { symbol: "LINDEINDIA", name: "Linde India Ltd", basePrice: 7048 },
  { symbol: "LLOYDSME", name: "Lloyds Metals & Energy", basePrice: 2052.8 },
  { symbol: "LXCHEM", name: "Laxmi Organic Industries", basePrice: 177.97 },
  { symbol: "MAHABANK", name: "Bank of Maharashtra", basePrice: 78.88 },
  { symbol: "MAHMAGNE", name: "Mahindra Logistics Ltd", basePrice: 164.73 },
  { symbol: "MAHSEAMLES", name: "Maharashtra Seamless", basePrice: 607.85 },
  { symbol: "MANAPPURAM", name: "Manappuram Finance Ltd", basePrice: 369.3 },
  { symbol: "MAPMYINDIA", name: "CE Info Systems Ltd", basePrice: 985 },
  { symbol: "MASTEK", name: "Mastek Ltd", basePrice: 1802.5 },
  { symbol: "MAZDOCK", name: "Mazagon Dock Shipbuilders", basePrice: 2575 },
  { symbol: "METROPOLIS", name: "Metropolis Healthcare", basePrice: 572.65 },
  { symbol: "MHRIL", name: "Mahindra Holidays & Res", basePrice: 230.31 },
  { symbol: "MSUMI", name: "Motherson Sumi Wiring", basePrice: 41.04 },
  { symbol: "NATCOPHARM", name: "Natco Pharma Ltd", basePrice: 910.5 },
  { symbol: "NBCC", name: "NBCC India Ltd", basePrice: 94.85 },
  { symbol: "NCC", name: "NCC Ltd", basePrice: 146.45 },
  { symbol: "NESCO", name: "Nesco Ltd", basePrice: 1045.4 },
  { symbol: "NH", name: "Narayana Hrudayalaya Ltd", basePrice: 1834.6 },
  { symbol: "NHPC", name: "NHPC Ltd", basePrice: 77.2 },
  { symbol: "NIPPON", name: "Nippon Life India Asset", basePrice: 27.24 },
  { symbol: "NLCINDIA", name: "NLC India Ltd", basePrice: 285.35 },
  { symbol: "NSLNISP", name: "NMDC Steel Ltd", basePrice: 44.67 },
  { symbol: "NUVAMA", name: "Nuvama Wealth Management", basePrice: 1635.6 },
  { symbol: "NYKAA", name: "FSN E-Commerce Ventures", basePrice: 323.7 },
  { symbol: "OLECTRA", name: "Olectra Greentech Ltd", basePrice: 1368.3 },
  { symbol: "PANGEO", name: "Panacea Biotec Ltd", basePrice: 404.3 },
  { symbol: "PATANJALI", name: "Patanjali Foods Ltd", basePrice: 355 },
  { symbol: "PBFINTECH", name: "PB Fintech (Policybazaar)", basePrice: 1630 },
  { symbol: "PGHH", name: "Procter & Gamble Hygiene", basePrice: 8482 },
  { symbol: "PNBHOUSING", name: "PNB Housing Finance", basePrice: 1149.3 },
  { symbol: "POLYMED", name: "Poly Medicure Ltd", basePrice: 1772.4 },
  { symbol: "POONAWALLA", name: "Poonawalla Fincorp Ltd", basePrice: 476.7 },
  { symbol: "PRINCEPIPE", name: "Prince Pipes & Fittings", basePrice: 271.95 },
  { symbol: "PRSMJOHNSN", name: "Prism Johnson Ltd", basePrice: 109 },
  { symbol: "RADICO", name: "Radico Khaitan Ltd", basePrice: 4550 },
  { symbol: "RVNL", name: "Rail Vikas Nigam Ltd", basePrice: 230.68 },
  { symbol: "RAYMOND", name: "Raymond Ltd", basePrice: 627 },
  { symbol: "RBLBANK", name: "RBL Bank Ltd", basePrice: 391 },
  { symbol: "RHIM", name: "RHI Magnesita India", basePrice: 423.35 },
  { symbol: "RITES", name: "RITES Ltd", basePrice: 232.84 },
  { symbol: "RKFORGE", name: "Ramkrishna Forgings Ltd", basePrice: 736.2 },
  { symbol: "ROUTE", name: "Route Mobile Ltd", basePrice: 535.5 },
  { symbol: "RPOWER", name: "Reliance Power Ltd", basePrice: 23.96 },
  { symbol: "SAPPHIRE", name: "Sapphire Foods India", basePrice: 220.62 },
  { symbol: "SCI", name: "Shipping Corp of India", basePrice: 294.95 },
  { symbol: "SURYODAY", name: "Suryoday Small Finance Bank", basePrice: 152.06 },
  { symbol: "SHARDACROP", name: "Sharda Cropchem Ltd", basePrice: 812.6 },
  { symbol: "SHOPERSTOP", name: "Shoppers Stop Ltd", basePrice: 425.9 },
  { symbol: "SHREECEAM", name: "Shree Cement Ltd", basePrice: 26100 },
  { symbol: "SHYAMMETL", name: "Shyam Metalics & Energy", basePrice: 1003.1 },
  { symbol: "SOBHA", name: "Sobha Ltd", basePrice: 1355.7 },
  { symbol: "SOLARINDS", name: "Solar Industries India", basePrice: 18820 },
  { symbol: "STARHEALTH", name: "Star Health & Allied Ins", basePrice: 574.95 },
  { symbol: "SUMICHEM", name: "Sumitomo Chemical India", basePrice: 561.25 },
  { symbol: "SUNDARMFIN", name: "Sundaram Finance Ltd", basePrice: 4568.5 },
  { symbol: "SUNDRMFAST", name: "Sundram Fasteners Ltd", basePrice: 1121.3 },
  { symbol: "SUNTECK", name: "Sunteck Realty Ltd", basePrice: 298.55 },
  { symbol: "SUPRAJIT", name: "Suprajit Engineering Ltd", basePrice: 529.25 },
  { symbol: "SUVENPHAR", name: "Suven Pharmaceuticals", basePrice: 840 },
  { symbol: "SYRMA", name: "Syrma SGS Technology", basePrice: 1516.4 },
  { symbol: "TARC", name: "TARC Ltd", basePrice: 131.38 },
  { symbol: "TARSONS", name: "Tarsons Products Ltd", basePrice: 313.5 },
  { symbol: "TATAINVEST", name: "Tata Investment Corp", basePrice: 687.9 },
  { symbol: "TIRUMALCHM", name: "Thirumalai Chemicals", basePrice: 164.68 },
  { symbol: "TITAGARH", name: "Titagarh Rail Systems", basePrice: 839.45 },
  { symbol: "TRIDENT", name: "Trident Ltd", basePrice: 24.81 },
  { symbol: "TRIVENI", name: "Triveni Engineering & Ind", basePrice: 243.03 },
  { symbol: "TRITURBINE", name: "Triveni Turbine Ltd", basePrice: 636.75 },
  { symbol: "TIIL", name: "Techno Electric & Eng", basePrice: 2675.3 },
  { symbol: "UCOBANK", name: "UCO Bank", basePrice: 26.12 },
  { symbol: "UNOMINDA", name: "Uno Minda Ltd", basePrice: 1288 },
  { symbol: "UBL", name: "United Breweries Ltd", basePrice: 1382.8 },
  { symbol: "MCDOWELL-N", name: "United Spirits Ltd", basePrice: 1522 },
  { symbol: "USHAMART", name: "Usha Martin Ltd", basePrice: 516.8 },
  { symbol: "VAIBHAVGBL", name: "Vaibhav Global Ltd", basePrice: 238.45 },
  { symbol: "VGUARD", name: "V-Guard Industries Ltd", basePrice: 320.85 },
  { symbol: "VINATIORGA", name: "Vinati Organics Ltd", basePrice: 1321.6 },
  { symbol: "VIPIND", name: "VIP Industries Ltd", basePrice: 319.5 },
  { symbol: "WELCORP", name: "Welspun Corp Ltd", basePrice: 1848.5 },
  { symbol: "WELSPUNLIV", name: "Welspun Living Ltd", basePrice: 164.29 },
  { symbol: "WESTLIFE", name: "Westlife Foodworld Ltd", basePrice: 586.15 },
  { symbol: "WHIRLPOOL", name: "Whirlpool of India Ltd", basePrice: 802.75 },
  { symbol: "ZENSARTECH", name: "Zensar Technologies Ltd", basePrice: 498.85 },
  { symbol: "ZFINDIA", name: "ZF Commercial Vehicle Control", basePrice: 2609.6 },
];

let candleStore: Record<string, Record<Timeframe, Candle[]>> = {};

const dhanApiCache: Record<string, { candles: Candle[]; cachedAt: number }> = {};
let dhanRateLimitedUntil = 0;

export function resetCandleStore(force = false) {
  if (force) {
    for (const key of Object.keys(dhanApiCache)) {
      delete dhanApiCache[key];
    }
  } else {
    const now = Date.now();
    for (const key of Object.keys(dhanApiCache)) {
      if (now - dhanApiCache[key].cachedAt > 60000) {
        delete dhanApiCache[key];
      }
    }
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function formatISTTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function snapToNSEMarketTimestamp(input: Date | string | number, timeframe: Timeframe): string {
  const minutesMap: Record<Timeframe, number> = {
    '1M': 1,
    '5M': 5,
    '10M': 10,
    '30M': 30
  };
  const stepMin = minutesMap[timeframe] || 5;
  const openMins = 9 * 60 + 15;
  const closeMins = 15 * 60 + 30;

  let h = 9, m = 15;
  let dateObj: Date | null = null;
  if (input instanceof Date) {
    dateObj = input;
  } else if (typeof input === 'number') {
    dateObj = new Date(input);
  } else if (typeof input === 'string') {
    if (input.includes('T') || input.includes('-') || input.includes('/')) {
      const parsed = new Date(input);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }
  }

  if (dateObj && !isNaN(dateObj.getTime())) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(dateObj);
    for (const p of parts) {
      if (p.type === 'hour') h = parseInt(p.value, 10);
      if (p.type === 'minute') m = parseInt(p.value, 10);
    }
  } else if (typeof input === 'string') {
    const match = input.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      let hour = parseInt(match[1], 10);
      const min = parseInt(match[2], 10);
      const period = match[3]?.toUpperCase();
      if (period === 'PM' && hour < 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      h = hour;
      m = min;
    }
  }

  let candleMins = h * 60 + m;
  if (candleMins < openMins) candleMins = openMins;
  if (candleMins >= closeMins) candleMins = closeMins - stepMin;

  const elapsed = candleMins - openMins;
  const slotIndex = Math.floor(elapsed / stepMin);
  const maxSlot = Math.floor((closeMins - openMins - 1) / stepMin);
  const clampedSlot = Math.max(0, Math.min(maxSlot, slotIndex));

  const snappedMins = openMins + clampedSlot * stepMin;
  const snappedHour = Math.floor(snappedMins / 60);
  const snappedMin = snappedMins % 60;

  const period = snappedHour >= 12 ? 'PM' : 'AM';
  const displayHour = snappedHour % 12 === 0 ? 12 : snappedHour % 12;
  const padH = displayHour < 10 ? `0${displayHour}` : `${displayHour}`;
  const padM = snappedMin < 10 ? `0${snappedMin}` : `${snappedMin}`;

  return `${padH}:${padM} ${period}`;
}

export function isMarketTradingHours(): { isTradingHours: boolean; reason?: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(now);

  let weekday = 'Mon';
  let h = 0, m = 0;
  for (const p of parts) {
    if (p.type === 'weekday') weekday = p.value;
    if (p.type === 'hour') h = parseInt(p.value, 10);
    if (p.type === 'minute') m = parseInt(p.value, 10);
  }

  const currentMins = h * 60 + m;
  if (weekday === 'Sat' || weekday === 'Sun') {
    return { isTradingHours: false, reason: 'Market is closed on weekends (Saturday & Sunday).' };
  }

  const startMins = 9 * 60;
  const endMins = 15 * 60 + 30;

  if (currentMins < startMins || currentMins > endMins) {
    return { isTradingHours: false, reason: 'Outside market hours.' };
  }

  return { isTradingHours: true };
}

/**
 * Helper to compute precise IST market timing and current session progress.
 * Uses exact Asia/Kolkata timezone so it is 100% platform-independent and timezone-safe.
 */
export function getISTMarketContext(timeframe: Timeframe) {
  const minutesMap: Record<Timeframe, number> = {
    '1M': 1,
    '5M': 5,
    '10M': 10,
    '30M': 30
  };
  const stepMin = minutesMap[timeframe] || 30;
  const openMins = 9 * 60 + 15;   // 555 (09:15 AM IST)
  const closeMins = 15 * 60 + 30; // 930 (03:30 PM IST)
  const slotsPerDay = Math.max(1, Math.floor((closeMins - openMins) / stepMin));

  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(now);

  let h = 9, m = 15;
  for (const p of parts) {
    if (p.type === 'hour') h = parseInt(p.value, 10) % 24;
    if (p.type === 'minute') m = parseInt(p.value, 10);
  }
  const currentMins = h * 60 + m;

  let isDuringMarket = false;
  let todayCandlesCount = slotsPerDay;
  let currentSlotIndex = slotsPerDay - 1;

  if (currentMins >= openMins && currentMins < closeMins) {
    isDuringMarket = true;
    const elapsed = currentMins - openMins;
    currentSlotIndex = Math.min(slotsPerDay - 1, Math.floor(elapsed / stepMin));
    todayCandlesCount = currentSlotIndex + 1;
  } else if (currentMins < openMins) {
    isDuringMarket = false;
    currentSlotIndex = 0;
    todayCandlesCount = 1;
  } else {
    isDuringMarket = false;
    currentSlotIndex = slotsPerDay - 1;
    todayCandlesCount = slotsPerDay;
  }

  const maxAllowedMinsToday = isDuringMarket ? currentMins : (currentMins < openMins ? openMins : closeMins);

  return {
    stepMin,
    openMins,
    closeMins,
    slotsPerDay,
    currentMins,
    isDuringMarket,
    currentSlotIndex,
    todayCandlesCount,
    maxAllowedMinsToday
  };
}

const SYMBOL_NS_MAP: Record<string, string> = {
  'TATAMOTORS': 'TMPV.NS',
  'REC': 'RECLTD.NS',
  'PBFINTECH': 'POLICYBZR.NS',
  'MCDOWELL-N': 'UNITDSPR.NS',
  'ADANITRANS': 'ADANIENSOL.NS',
  'M&M': 'M%26M.NS',
  'BAJAJ-AUTO': 'BAJAJ-AUTO.NS',
  'LTIM': 'LTIM.NS'
};

export async function fetchLiveNSECandles(
  stock: StockMaster,
  timeframe: Timeframe
): Promise<Candle[] | null> {
  const yIntervalMap: Record<Timeframe, string> = {
    '1M': '1m',
    '5M': '5m',
    '10M': '5m',
    '30M': '30m'
  };
  const interval = yIntervalMap[timeframe] || '5m';
  const range = (timeframe === '1M' || timeframe === '5M') ? '2d' : '5d';

  const ticker = SYMBOL_NS_MAP[stock.symbol] || `${encodeURIComponent(stock.symbol)}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;

  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 4000
    });

    const result = res.data?.chart?.result?.[0];
    if (!result) return null;

    const quotes = result.indicators?.quote?.[0];
    const timestamps = result.timestamp;
    if (!quotes || !timestamps || timestamps.length === 0) return null;

    const rawCandles: { timestamp: Date; open: number; high: number; low: number; close: number; volume: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.open[i] != null && quotes.close[i] != null) {
        rawCandles.push({
          timestamp: new Date(timestamps[i] * 1000),
          open: Number(quotes.open[i].toFixed(2)),
          high: Number((quotes.high[i] ?? quotes.close[i]).toFixed(2)),
          low: Number((quotes.low[i] ?? quotes.close[i]).toFixed(2)),
          close: Number(quotes.close[i].toFixed(2)),
          volume: quotes.volume[i] || 0
        });
      }
    }

    if (rawCandles.length === 0) return null;

    let finalRaw = rawCandles;
    if (timeframe === '10M') {
      const agg = [];
      for (let i = 0; i < rawCandles.length; i += 2) {
        const c1 = rawCandles[i];
        const c2 = rawCandles[i + 1] || c1;
        agg.push({
          timestamp: c1.timestamp,
          open: c1.open,
          high: Math.max(c1.high, c2.high),
          low: Math.min(c1.low, c2.low),
          close: c2.close,
          volume: c1.volume + c2.volume
        });
      }
      finalRaw = agg;
    }

    const candles: Candle[] = finalRaw.map(c => ({
      timestamp: snapToNSEMarketTimestamp(c.timestamp, timeframe),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }));

    if (candles.length > 0) {
      stock.basePrice = candles[candles.length - 1].close;
    }

    return candles;
  } catch {
    return null;
  }
}

export async function getStockCandles(
  stock: StockMaster,
  timeframe: Timeframe,
  dhanClientId?: string,
  dhanAccessToken?: string
): Promise<Candle[]> {
  const cacheKey = `${stock.symbol}_${timeframe}`;

  const cached = dhanApiCache[cacheKey];
  if (cached && (Date.now() - cached.cachedAt < 3000)) {
    return cached.candles;
  }

  const trimmedClientId = dhanClientId?.trim();
  const trimmedToken = dhanAccessToken?.trim();

  if (trimmedClientId && trimmedToken && Date.now() > dhanRateLimitedUntil) {
    try {
      const secId = stock.securityId || stock.symbol;
      const response = await axios.post(
        "http://15.252.191.43:3000/api/dhan-relay/charts/intraday",
        {
          securityId: secId,
          exchangeSegment: "NSE_EQ",
          instrument: "EQUITY",
          interval: timeframe.replace("M", ""),
          fromDate: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
          toDate: new Date().toISOString().split("T")[0]
        },
        {
          headers: {
            "client-id": trimmedClientId,
            "access-token": trimmedToken,
            "Content-Type": "application/json"
          },
          timeout: 4000
        }
      ).catch(() => {
        // Fallback to direct relay endpoint if subpath differs
        return axios.post(
          "http://15.252.191.43:3000/api/dhan-relay",
          {
            action: "charts/intraday",
            securityId: secId,
            exchangeSegment: "NSE_EQ",
            instrument: "EQUITY",
            interval: timeframe.replace("M", ""),
            fromDate: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
            toDate: new Date().toISOString().split("T")[0]
          },
          {
            headers: {
              "client-id": trimmedClientId,
              "access-token": trimmedToken,
              "Content-Type": "application/json"
            },
            timeout: 4000
          }
        );
      });

      if (response && response.data?.data?.close?.length > 0) {
        const d = response.data.data;
        const candles: Candle[] = [];
        for (let i = 0; i < d.close.length; i++) {
          const t = new Date(d.start_Time[i] * 1000);
          candles.push({
            timestamp: snapToNSEMarketTimestamp(t, timeframe),
            open: d.open[i],
            high: d.high[i],
            low: d.low[i],
            close: d.close[i],
            volume: d.volume[i]
          });
        }
        if (candles.length > 0) {
          stock.basePrice = candles[candles.length - 1].close;
        }
        dhanApiCache[cacheKey] = { candles, cachedAt: Date.now() };
        return candles;
      }
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        dhanRateLimitedUntil = Date.now() + 60000;
      }
    }
  }

  const liveNSECandles = await fetchLiveNSECandles(stock, timeframe);
  if (liveNSECandles && liveNSECandles.length > 0) {
    dhanApiCache[cacheKey] = { candles: liveNSECandles, cachedAt: Date.now() };
    return liveNSECandles;
  }

  return [];
}
