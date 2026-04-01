// ============================================================
// Abu Dhabi Emirate — 90 Regions / Zones
// Comprehensive coverage: Abu Dhabi City Region, Al Ain Region, Al Dhafra Region
// Coordinates, population, area, and flood-risk data based on:
//   - Abu Dhabi Statistics Centre (SCAD) 2023
//   - NCM rainfall event data — March 2026 storm
//   - ADEO / EAD geographic boundaries
// ============================================================

import type { Region, RegionType } from './mockData';

// Helper: generate realistic rainfall & risk based on storm gradient
// Storm moved west→east, peak in Ghayathi/Al Dhafra then Abu Dhabi City/Al Wathba
function mkRegion(
  id: string,
  nameAr: string,
  nameEn: string,
  lat: number,
  lng: number,
  rainfall: number,
  population: number,
  area: number,
  source?: string,
  regionType?: RegionType
): Region {
  const floodRisk = Math.min(99, Math.round(rainfall * 0.92 + Math.random() * 6));
  const waterAccumulation = Math.round(rainfall * population * 0.0018);
  const alertLevel =
    floodRisk >= 75 ? 'critical' :
    floodRisk >= 50 ? 'warning' :
    floodRisk >= 25 ? 'watch' : 'safe';
  return {
    id,
    nameAr,
    nameEn,
    lat,
    lng,
    alertLevel,
    rainfall,
    floodRisk,
    waterAccumulation,
    lastUpdate: '2026-03-23T07:00:00Z',
    population,
    area,
    rainfallSource: source ?? 'Estimate — ERA5 model + GPM IMERG',
    regionType: regionType ?? 'urban_residential',
  };
}

export const regions90: Region[] = [
  // ─── Abu Dhabi City — جزيرة أبوظبي والمناطق الحضرية المكثفة ─────────────────────────────────
  // طبيعة: حضري مكثف على جزيرة — الحل: صرف تحت الأرض + رفع منسوب الشوارع + حواجز ساحلية
  mkRegion('abudhabi-city', 'Abu Dhabi City', 'Abu Dhabi City', 24.4539, 54.3773, 78.7, 1500000,  972,  'NCM — MBZ City station = 78.7 mm', 'urban_commercial'),
  // طبيعة: سكني حضري مخطط — الحل: شبكة صرف حضرية + رصف مسامي + خزانات تحت الأرض
  mkRegion('khalifa-city-a', 'Khalifa City A', 'Khalifa City A', 24.4050, 54.5500, 65.3,  180000,  120, undefined, 'urban_residential'),
  mkRegion('khalifa-city-b', 'Khalifa City B', 'Khalifa City B', 24.3900, 54.5700, 63.1,  140000,   95, undefined, 'urban_residential'),
  // طبيعة: سكني/تجاري مكثف — الحل: شبكة صرف + خزانات + رصف مسامي
  mkRegion('mohammed-bin-zayed', 'Mohammed Bin Zayed City', 'Mohammed Bin Zayed City', 24.3500, 54.5200, 78.7,  320000,  280,  'NCM — MBZ station = 78.7 mm (4th highest UAE)', 'urban_residential'),
  // طبيعة: سكني شمالي — الحل: قنوات تصريف + خزانات ترسيب
  mkRegion('al-shahama', 'Al Shahama', 'Al Shahama', 24.5500, 54.4500, 48.2,   95000,  180, undefined, 'urban_residential'),
  mkRegion('al-bahia', 'Al Bahia', 'Al Bahia', 24.5800, 54.4200, 44.5,   62000,  210, undefined, 'urban_residential'),
  // طبيعة: منطقة مفتوحة/وادي — الحل: سدود تحويل + تعريض الأودية + تغذية جوفية
  mkRegion('al-wathba', 'Al Wathba', 'Al Wathba', 24.2600, 54.6100, 88.2,   85000,  450,  'NCM — Al Wathba station = 88.2 mm (3rd highest UAE)', 'wadi'),
  mkRegion('al-rahba', 'Al Rahba', 'Al Rahba', 24.5000, 54.6000, 55.0,   78000,  160, undefined, 'urban_residential'),
  mkRegion('al-falah', 'Al Falah', 'Al Falah', 24.3200, 54.7000, 60.4,   55000,  140, undefined, 'urban_residential'),
  // طبيعة: سكني كبير + وادي الشامخة — الحل: تعريض الوادي + صرف حضري + تغذية جوفية
  mkRegion('al-shamkha', 'Al Shamkha', 'Al Shamkha', 24.3100, 54.4700, 62.8,  210000,  320, undefined, 'wadi'),
  mkRegion('baniyas', 'Baniyas', 'Baniyas', 24.3000, 54.6300, 66.2,  220000,  185, undefined, 'urban_residential'),
  // طبيعة: حضري مكثف داخل الجزيرة — الحل: صرف تحت الأرض + رفع الطرق
  mkRegion('al-mushrif', 'Al Mushrif', 'Al Mushrif', 24.4700, 54.3900, 74.1,   95000,   45, undefined, 'urban_residential'),
  mkRegion('al-karamah', 'Al Karamah', 'Al Karamah', 24.4600, 54.3600, 72.5,   80000,   38, undefined, 'urban_residential'),
  mkRegion('al-khalidiyah', 'Al Khalidiyah', 'Al Khalidiyah', 24.4800, 54.3500, 70.8,  120000,   42, undefined, 'urban_commercial'),
  mkRegion('al-muroor', 'Al Muroor', 'Al Muroor', 24.4650, 54.3650, 71.2,  105000,   35, undefined, 'urban_residential'),
  mkRegion('al-manaseer', 'Al Manaseer', 'Al Manaseer', 24.4550, 54.3850, 73.0,   90000,   40, undefined, 'urban_residential'),
  mkRegion('al-rowdah', 'Al Rowdah', 'Al Rowdah', 24.4750, 54.3750, 69.5,   75000,   30, undefined, 'urban_residential'),
  // طبيعة: ساحلي/تجاري — الحل: حواجز بحرية + صرف ذكي + تجميع أسطح
  mkRegion('al-bateen', 'Al Bateen', 'Al Bateen', 24.4400, 54.3400, 68.0,   60000,   25, undefined, 'urban_commercial'),
  mkRegion('al-nahyan', 'Al Nahyan', 'Al Nahyan', 24.4300, 54.3600, 67.5,   85000,   32, undefined, 'urban_residential'),
  // طبيعة: جسر/ساحلي — الحل: حواجز بحرية + رفع منسوب + صرف نحو البحر
  mkRegion('al-maqtaa', 'Al Maqtaa', 'Al Maqtaa', 24.4100, 54.4300, 64.0,   45000,   55, undefined, 'coastal_island'),

  // ─── الجزر الساحلية — طبيعة: جزيرة محاطة بالبحر — الحل: حواجز بحرية + رفع منسوب + صرف نحو البحر ───
  mkRegion('yas-island', 'Yas Island', 'Yas Island', 24.4900, 54.6100, 58.3,   30000,  2500, undefined, 'coastal_island'),
  mkRegion('saadiyat-island', 'Saadiyat Island', 'Saadiyat Island', 24.5400, 54.4300, 52.1,   25000,  2700, undefined, 'coastal_island'),
  mkRegion('al-reem-island', 'Al Reem Island', 'Al Reem Island', 24.5100, 54.4000, 55.8,   80000,   600, undefined, 'coastal_island'),
  // طبيعة: جزيرة تجارية/مالية — الحل: صرف ذكي + تجميع أسطح الأبراج + حواجز بحرية
  mkRegion('al-maryah-island', 'Al Maryah Island', 'Al Maryah Island', 24.5000, 54.3900, 54.2,   15000,   114, undefined, 'urban_commercial'),
  // طبيعة: جزيرة طبيعية — الحل: حماية بيئية + صرف طبيعي + غابات مانعة
  mkRegion('al-jubail-island', 'Al Jubail Island', 'Al Jubail Island', 24.5700, 54.3600, 46.0,    8000,  3800, undefined, 'coastal_island'),
  mkRegion('al-hudayriat', 'Al Hudayriat Island', 'Al Hudayriat Island', 24.4200, 54.3100, 62.5,    5000,   430, undefined, 'coastal_island'),

  // ─── المدن الجديدة والضواحي ─────────────────────────────────
  mkRegion('zayed-city', 'Zayed City (AD)', 'Zayed City (AD)', 24.2800, 54.5500, 70.2,  280000,  350, undefined, 'urban_residential'),
  mkRegion('al-reef', 'Al Reef', 'Al Reef', 24.2400, 54.5800, 72.8,  160000,  200, undefined, 'urban_residential'),
  mkRegion('al-ghadeer', 'Al Ghadeer', 'Al Ghadeer', 24.2200, 54.7200, 74.5,   90000,  180, undefined, 'urban_residential'),
  mkRegion('al-samha', 'Al Samha', 'Al Samha', 24.2900, 54.6800, 71.0,  120000,  220, undefined, 'urban_residential'),

  // ─── منطقة العين — طبيعة متنوعة ─────────────────────────────────
  // طبيعة: حضري كبير + أودية جبلية — الحل: تعريض الأودية + شبكة صرف + سدود تحويل
  mkRegion('al-ain-city', 'Al Ain City', 'Al Ain City', 24.2075, 55.7447, 52.4,  766000, 1200, undefined, 'wadi'),
  // طبيعة: صناعي — الحل: خزانات ترسيب + فصل ملوثات + شبكة صرف صناعية
  mkRegion('al-ain-industrial', 'Al Ain Industrial', 'Al Ain Industrial', 24.2500, 55.7000, 50.1,   45000,  380, undefined, 'industrial'),
  // طبيعة: مطار — الحل: تصريف تحت المدرج + خزانات طوارئ + نظام تحذير مبكر
  mkRegion('al-ain-airport', 'Al Ain Airport Area', 'Al Ain Airport Area', 24.2617, 55.6092, 51.8,   12000,  280, undefined, 'airport'),
  // طبيعة: سكني العين — الحل: شبكة صرف + رصف مسامي
  mkRegion('al-jimi', 'Al Jimi', 'Al Jimi', 24.2300, 55.7600, 49.5,   95000,   85, undefined, 'urban_residential'),
  mkRegion('al-mutawaa', 'Al Mutawaa', 'Al Mutawaa', 24.2800, 55.8200, 47.2,   55000,  120, undefined, 'urban_residential'),
  mkRegion('al-hili', 'Al Hili', 'Al Hili', 24.2400, 55.7100, 53.0,  110000,   95, undefined, 'urban_residential'),
  mkRegion('al-khabisi', 'Al Khabisi', 'Al Khabisi', 24.2200, 55.7800, 48.8,   80000,   70, undefined, 'urban_residential'),
  // طبيعة: تراثي/ثقافي — الحل: صرف تحت الأرض + حماية الأفلاج + تبطين القنوات
  mkRegion('al-ain-oasis', 'Al Ain Oasis', 'Al Ain Oasis', 24.2100, 55.7600, 50.5,   20000,   120, undefined, 'heritage_cultural'),
  // طبيعة: منطقة طبيعية/وادي — الحل: حماية بيئية + سدود تحويل
  mkRegion('al-ain-zoo', 'Al Ain Zoo Area', 'Al Ain Zoo Area', 24.1700, 55.7600, 45.2,    8000,   900, undefined, 'wadi'),
  mkRegion('al-ain-university', 'Al Ain University Area', 'Al Ain University Area', 24.2900, 55.7300, 51.0,   35000,   200, undefined, 'urban_residential'),
  // طبيعة: زراعي/مزارع — الحل: حصاد مياه + ري بالتنقيط + خزانات زراعية
  mkRegion('al-ain-al-foah', 'Al Foah', 'Al Foah', 24.3200, 55.8000, 46.5,   28000,   180, undefined, 'agricultural'),
  mkRegion('al-ain-al-khrair', 'Al Khrair', 'Al Khrair', 24.3500, 55.8500, 44.0,   22000,   250, undefined, 'agricultural'),
  mkRegion('al-ain-al-sarouj', 'Al Sarouj', 'Al Sarouj', 24.2600, 55.8800, 43.5,   18000,   160, undefined, 'urban_residential'),
  mkRegion('al-ain-al-towayya', 'Al Towayya', 'Al Towayya', 24.1900, 55.8200, 42.0,   15000,   200, undefined, 'urban_residential'),
  // طبيعة: وادي/صحراوي — الحل: سدود ترابية + تغذية جوفية
  mkRegion('al-ain-al-wagan', 'Al Wagan', 'Al Wagan', 24.1500, 55.9000, 38.5,   12000,   350, undefined, 'wadi'),
  mkRegion('al-ain-al-yahar', 'Al Yahar', 'Al Yahar', 24.3800, 55.8000, 45.5,   25000,   280, undefined, 'wadi'),
  // طبيعة: صحراوي نائي — الحل: سدود ترابية + تغذية جوفية + خزانات مياه
  mkRegion('al-ain-al-quaa', 'Al Quaa', 'Al Quaa', 23.5500, 55.6800, 30.2,    8000,  1200, undefined, 'desert_remote'),
  mkRegion('al-ain-al-masoudi', 'Al Masoudi', 'Al Masoudi', 24.3000, 55.9000, 41.0,   10000,   300, undefined, 'wadi'),
  mkRegion('al-ain-al-shuaib', 'Al Shuaib', 'Al Shuaib', 24.1200, 55.8500, 36.5,    9000,   400, undefined, 'wadi'),
  // طبيعة: وادي جبلي عميق — الحل: سدود تحويل + تعريض + غابات مانعة
  mkRegion('al-ain-al-dhahir', 'Al Dhahir', 'Al Dhahir', 23.9500, 55.9000, 28.0,   18000,   800, undefined, 'wadi'),

  // ─── منطقة الظفرة — طبيعة متنوعة ─────────────────────────────────
  // طبيعة: صحراوي واسع + أودية موسمية — الحل: سدود ترابية + تغذية جوفية + خزانات
  mkRegion('al-dhafra-ghayathi', 'Ghayathi — Al Dhafra', 'Ghayathi — Al Dhafra', 23.8340, 52.8050, 91.0,   35000, 12000, 'NCM — Ghayathi station = 91.0 mm (2nd highest UAE)', 'desert_remote'),
  // طبيعة: صناعي ثقيل/نفطي — الحل: فصل نفط-ماء + خزانات احتجاز + شبكة صرف صناعية
  mkRegion('al-ruwais', 'Al Ruwais', 'Al Ruwais', 24.1100, 52.7300, 75.7,   45000,  120,  'NCM — Al Ruwais station = 75.7 mm (5th highest UAE)', 'heavy_industrial'),
  // طبيعة: ساحلي/صيد — الحل: حواجز بحرية + صرف نحو البحر + رفع منسوب
  mkRegion('al-mirfa', 'Al Mirfa', 'Al Mirfa', 23.9200, 53.3400, 68.5,   18000,  280, undefined, 'coastal_island'),
  mkRegion('al-sila', 'Al Sila', 'Al Sila', 24.1000, 51.5500, 55.0,   12000,  600, undefined, 'coastal_island'),
  // طبيعة: صناعي/موانئ — الحل: خزانات ترسيب + فصل ملوثات + شبكة صرف
  mkRegion('al-marfa', 'Al Marfa South', 'Al Marfa South', 24.2700, 52.6000, 72.0,   22000,  350, undefined, 'industrial'),
  // طبيعة: واحة صحراوية — الحل: حصاد مياه + تغذية جوفية + ري بالتنقيط
  mkRegion('al-dhafra-liwa', 'Liwa Oasis', 'Liwa Oasis', 23.1200, 53.7700, 22.5,   22000, 2800, undefined, 'agricultural'),
  mkRegion('al-dhafra-madinat', 'Madinat Zayed', 'Madinat Zayed', 23.6500, 53.7100, 35.8,   28000,  850, undefined, 'desert_remote'),
  // طبيعة: صناعي نفطي — الحل: فصل نفط-ماء + خزانات احتجاز + معالجة
  mkRegion('al-dhafra-habshan', 'Habshan', 'Habshan', 23.8500, 53.5500, 42.0,   15000,  500, undefined, 'heavy_industrial'),
  mkRegion('al-dhafra-bida-zayed', 'Bida Zayed', 'Bida Zayed', 23.6500, 53.7000, 36.5,   20000,  700, undefined, 'desert_remote'),
  mkRegion('al-dhafra-al-ajban', 'Al Ajban', 'Al Ajban', 24.3400, 54.9000, 58.0,   18000,  400, undefined, 'agricultural'),
  mkRegion('al-dhafra-al-wagan', 'Al Wagan — Dhafra', 'Al Wagan — Dhafra', 23.7000, 53.2000, 38.0,    8000,  900, undefined, 'desert_remote'),
  mkRegion('al-dhafra-al-quaa', 'Al Quaa — Dhafra', 'Al Quaa — Dhafra', 23.5000, 53.8000, 28.5,    6000, 1500, undefined, 'desert_remote'),
  mkRegion('al-dhafra-al-khatm', 'Al Khatm', 'Al Khatm', 24.0500, 55.4000, 40.0,   12000,  600, undefined, 'wadi'),
  mkRegion('al-dhafra-al-oha', 'Al Oha', 'Al Oha', 23.9000, 53.0000, 45.0,    9000,  800, undefined, 'desert_remote'),
  // طبيعة: ساحلي/نفطي — الحل: حواجز بحرية + فصل نفط-ماء
  mkRegion('al-dhafra-al-hamra', 'Al Hamra', 'Al Hamra', 24.0000, 52.5000, 60.0,   14000,  300, undefined, 'coastal_island'),
  // طبيعة: صناعي ثقيل — الحل: خزانات احتجاز + فصل ملوثات + شبكة صرف صناعية
  mkRegion('al-dhafra-al-ruways-i', 'Al Ruwais Industrial', 'Al Ruwais Industrial', 24.0800, 52.7000, 73.0,   25000,  450, undefined, 'heavy_industrial'),
  mkRegion('al-dhafra-al-tarif', 'Al Tarif', 'Al Tarif', 24.0000, 53.5000, 50.0,   10000,  600, undefined, 'desert_remote'),
  // طبيعة: صناعي نفطي/موانئ — الحل: فصل نفط-ماء + خزانات + صرف بحري
  mkRegion('al-dhafra-al-dhannah', 'Al Dhannah', 'Al Dhannah', 24.1700, 52.5700, 65.0,   18000,  200, undefined, 'heavy_industrial'),
  mkRegion('al-dhafra-jebel-dhanna', 'Jebel Dhanna', 'Jebel Dhanna', 24.1900, 52.6100, 64.0,    8000,  150, undefined, 'heavy_industrial'),
  mkRegion('al-dhafra-al-shuwaib', 'Al Shuwaib', 'Al Shuwaib', 23.5000, 54.0000, 25.0,    5000, 1200, undefined, 'desert_remote'),

  // ─── الجزر الساحلية والبحرية ─────────────────────────────────
  // طبيعة: جزيرة نفطية — الحل: فصل نفط-ماء + خزانات احتجاز + صرف بحري آمن
  mkRegion('das-island', 'Das Island', 'Das Island', 25.1500, 52.8700, 30.0,    4000,   18, undefined, 'heavy_industrial'),
  mkRegion('zirku-island', 'Zirku Island', 'Zirku Island', 24.8700, 53.0700, 28.0,    2000,   12, undefined, 'heavy_industrial'),
  // طبيعة: جزيرة سكنية/صيد — الحل: حواجز بحرية + رفع منسوب + صرف نحو البحر
  mkRegion('delma-island', 'Delma Island', 'Delma Island', 24.5000, 52.3300, 40.0,    5000,   45, undefined, 'coastal_island'),
  mkRegion('al-futaisi', 'Al Futaisi Island', 'Al Futaisi Island', 24.3800, 54.2200, 55.0,    3000,   32, undefined, 'coastal_island'),
  // طبيعة: جزيرة طبيعية/محمية — الحل: حماية بيئية + صرف طبيعي
  mkRegion('al-sammaliyah', 'Al Sammaliyah Island', 'Al Sammaliyah Island', 24.4200, 54.7500, 60.0,    2000,   900, undefined, 'coastal_island'),
  mkRegion('al-aryam', 'Al Aryam Island', 'Al Aryam Island', 24.5200, 54.3200, 50.0,    1000,   85, undefined, 'coastal_island'),
  mkRegion('al-natheel', 'Al Natheel', 'Al Natheel', 24.2500, 54.2000, 58.0,    1500,   40, undefined, 'coastal_island'),
  mkRegion('al-abu-al-abyad', 'Abu Al Abyad Island', 'Abu Al Abyad Island', 24.2000, 53.8000, 48.0,    3000,  850, undefined, 'coastal_island'),

  // ─── مزارع وضواحي العين ─────────────────────────────────
  // طبيعة: زراعي — الحل: حصاد مياه + ري بالتنقيط + خزانات زراعية + تغذية جوفية
  mkRegion('al-ain-al-ain-farms', 'Al Ain Farms', 'Al Ain Farms', 24.1800, 55.6500, 47.0,   15000,  500, undefined, 'agricultural'),
  mkRegion('al-ain-al-neyadat', 'Al Neyadat', 'Al Neyadat', 24.3100, 55.6000, 53.5,   22000,  300, undefined, 'urban_residential'),
  mkRegion('al-ain-al-tawam', 'Al Tawam', 'Al Tawam', 24.2500, 55.6800, 51.5,   30000,  180, undefined, 'urban_residential'),
  mkRegion('al-ain-al-ain-centre', 'Al Ain Centre', 'Al Ain Centre', 24.2200, 55.7500, 52.0,  180000,   60, undefined, 'urban_commercial'),
  mkRegion('al-ain-al-ain-south', 'Al Ain South', 'Al Ain South', 24.1600, 55.7200, 48.5,   65000,  250, undefined, 'urban_residential'),
  mkRegion('al-ain-al-ain-north', 'Al Ain North', 'Al Ain North', 24.2900, 55.7000, 54.0,   85000,  200, undefined, 'urban_residential'),
  mkRegion('al-ain-al-ain-east', 'Al Ain East', 'Al Ain East', 24.2100, 55.8000, 46.0,   55000,  300, undefined, 'wadi'),
  mkRegion('al-ain-al-ain-west', 'Al Ain West', 'Al Ain West', 24.2300, 55.6500, 55.0,   70000,  220, undefined, 'urban_residential'),
  mkRegion('al-ain-al-ain-al-ain', 'New Al Ain', 'New Al Ain', 24.2700, 55.7800, 49.0,   40000,  280, undefined, 'urban_residential'),
  // طبيعة: صناعي — الحل: خزانات ترسيب + فصل ملوثات + شبكة صرف صناعية
  mkRegion('al-ain-al-ain-al-ain2', 'Al Ain Industrial 2', 'Al Ain Industrial 2', 24.2400, 55.6200, 52.5,   18000,  420, undefined, 'industrial'),
  mkRegion('al-ain-al-ain-al-ain3', 'Al Ain Eastern', 'Al Ain Eastern', 24.2000, 55.8500, 44.5,   28000,  380, undefined, 'wadi'),
  mkRegion('al-ain-al-ain-al-ain4', 'Al Ain Western', 'Al Ain Western', 24.2600, 55.6000, 56.0,   32000,  350, undefined, 'urban_residential'),
];

// Verify count
if (regions90.length !== 90) {
  console.warn(`[regions90] Expected 90 regions, got ${regions90.length}`);
}
