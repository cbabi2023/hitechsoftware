#!/usr/bin/env node
// reset-and-seed-subjects.js
// Deletes ALL existing subjects (and cascaded data) then seeds fresh test data.
// Usage: node scripts/reset-and-seed-subjects.js [count]
// Default count: 100

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

async function main() {
  const targetCount = Number(process.argv[2] || '100');
  if (!Number.isFinite(targetCount) || targetCount <= 0) {
    throw new Error('Usage: node scripts/reset-and-seed-subjects.js <count>');
  }

  const envPath = path.join(__dirname, '..', 'web', '.env.local');
  if (!fs.existsSync(envPath)) throw new Error(`Missing env file: ${envPath}`);

  const env = loadEnv(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in web/.env.local');
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ─── STEP 1: Delete all subjects ─────────────────────────────────────────
  console.log('Deleting all existing subjects...');

  // Count first so we can report
  const { count: existingCount, error: countErr } = await supabase
    .from('subjects')
    .select('id', { count: 'exact', head: true });

  if (countErr) throw new Error(`Count check failed: ${countErr.message}`);
  console.log(`  Found ${existingCount ?? 0} existing subjects.`);

  if (existingCount > 0) {
    // Delete in batches of 1000 to avoid RPC timeout
    let deleted = 0;
    while (true) {
      // Fetch a batch of IDs
      const { data: batch, error: fetchErr } = await supabase
        .from('subjects')
        .select('id')
        .limit(1000);

      if (fetchErr) throw new Error(`Batch fetch failed: ${fetchErr.message}`);
      if (!batch || batch.length === 0) break;

      const ids = batch.map((r) => r.id);
      const { error: delErr } = await supabase
        .from('subjects')
        .delete()
        .in('id', ids);

      if (delErr) throw new Error(`Batch delete failed: ${delErr.message}`);
      deleted += ids.length;
      process.stdout.write(`\r  Deleted ${deleted} subjects...`);
    }
    console.log(`\n  Deleted ${deleted} subjects total.`);
  } else {
    console.log('  Nothing to delete.');
  }

  // Verify clean
  const { count: remaining } = await supabase
    .from('subjects')
    .select('id', { count: 'exact', head: true });
  console.log(`  Remaining subjects after delete: ${remaining ?? 0}`);

  // ─── STEP 2: Load reference data ─────────────────────────────────────────
  console.log('\nLoading reference data...');

  const [
    { data: brands, error: brandsErr },
    { data: dealers, error: dealersErr },
    { data: categories, error: catsErr },
  ] = await Promise.all([
    supabase.from('brands').select('id,name').eq('is_active', true).order('name'),
    supabase.from('dealers').select('id,name').eq('is_active', true).order('name'),
    supabase.from('service_categories').select('id,name').eq('is_active', true).order('name'),
  ]);

  if (brandsErr) throw new Error(`Failed to read brands: ${brandsErr.message}`);
  if (dealersErr) throw new Error(`Failed to read dealers: ${dealersErr.message}`);
  if (catsErr) throw new Error(`Failed to read service categories: ${catsErr.message}`);

  if (!brands?.length) throw new Error('No active brands found. Add at least one brand first.');
  if (!dealers?.length) throw new Error('No active dealers found. Add at least one dealer first.');
  if (!categories?.length) throw new Error('No active service categories found. Add at least one first.');

  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id,role')
    .eq('is_active', true)
    .eq('is_deleted', false)
    .in('role', ['super_admin', 'office_staff'])
    .order('role')
    .limit(1);

  if (profilesErr) throw new Error(`Failed to read profiles: ${profilesErr.message}`);
  if (!profiles?.length) throw new Error('No active super_admin/office_staff profile found for created_by.');

  const createdBy = profiles[0].id;
  console.log(`  Brands: ${brands.length}, Dealers: ${dealers.length}, Categories: ${categories.length}`);
  console.log(`  Will create subjects as: ${profiles[0].role} (${createdBy})`);

  // ─── STEP 3: Seed new subjects ────────────────────────────────────────────
  console.log(`\nSeeding ${targetCount} subjects...`);

  const priorities = ['critical', 'high', 'medium', 'low'];
  const serviceTypes = ['service', 'installation'];
  const warrantyTypes = ['in_warranty', 'amc', 'warranty_out', 'warranty_not_noted'];
  const productNames = [
    'Split AC', 'Window AC', 'Refrigerator', 'Washing Machine', 'Microwave Oven',
    'Dishwasher', 'Water Purifier', 'Air Cooler', 'Deep Freezer', 'Inverter AC',
    'Cassette AC', 'Ceiling Fan', 'Exhaust Fan', 'Electric Water Heater', 'Induction Cooktop',
  ];
  const streetNames = [
    'MG Road', 'NH Bypass', 'Sahodaran Ayyappan Road', 'Panampilly Nagar', 'Edapally Junction',
    'Kaloor', 'Thrippunithura', 'Aluva', 'Perumbavoor', 'Angamaly',
  ];

  const now = new Date();
  const runToken = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

  let success = 0;
  const failures = [];

  for (let i = 1; i <= targetCount; i++) {
    const sourceType = i % 2 === 0 ? 'brand' : 'dealer';
    const brand = brands[randomInt(brands.length)];
    const dealer = dealers[randomInt(dealers.length)];
    const category = categories[randomInt(categories.length)];
    const priority = priorities[randomInt(priorities.length)];
    const typeOfService = serviceTypes[randomInt(serviceTypes.length)];
    const product = productNames[randomInt(productNames.length)];
    const street = streetNames[randomInt(streetNames.length)];
    const wType = warrantyTypes[randomInt(warrantyTypes.length)];

    // Allocation date: today to +7 days
    const allocated = new Date(now);
    allocated.setDate(now.getDate() + randomInt(7));

    // Purchase date: 30 to 900 days ago
    const purchaseDate = new Date(now);
    purchaseDate.setDate(now.getDate() - (30 + randomInt(870)));

    const warrantyEndDate = new Date(purchaseDate);
    warrantyEndDate.setDate(purchaseDate.getDate() + 365);

    const expiredWarrantyEndDate = new Date(now);
    expiredWarrantyEndDate.setDate(now.getDate() - (7 + randomInt(365)));

    const amcEndDate = new Date(purchaseDate);
    amcEndDate.setDate(purchaseDate.getDate() + 730);

    const subjectNumber = `SEED-${runToken}-${String(i).padStart(3, '0')}`;

    const payload = {
      p_subject_number: subjectNumber,
      p_source_type: sourceType,
      p_brand_id: sourceType === 'brand' ? brand.id : null,
      p_dealer_id: sourceType === 'dealer' ? dealer.id : null,
      p_priority: priority,
      p_priority_reason: `Seeded ${priority} priority test job #${i} — ${product}`,
      p_allocated_date: allocated.toISOString().slice(0, 10),
      p_type_of_service: typeOfService,
      p_category_id: category.id,
      p_customer_phone: `9${String(800000000 + i).padStart(9, '0')}`,
      p_customer_name: `Test Customer ${i}`,
      p_customer_address: `${i + 10}, ${street}, Kochi, Kerala`,
      p_product_name: product,
      p_serial_number: `SN-${runToken}-${String(i).padStart(4, '0')}`,
      p_product_description: `${product} — seeded test subject ${subjectNumber}`,
      p_purchase_date: purchaseDate.toISOString().slice(0, 10),
      p_warranty_end_date:
        wType === 'in_warranty'
          ? warrantyEndDate.toISOString().slice(0, 10)
          : (wType === 'warranty_out' ? expiredWarrantyEndDate.toISOString().slice(0, 10) : null),
      p_amc_end_date: wType === 'amc' ? amcEndDate.toISOString().slice(0, 10) : null,
      p_created_by: createdBy,
    };

    const { data, error } = await supabase.rpc('create_subject_with_customer', payload);

    if (error || !data) {
      failures.push({ index: i, subjectNumber, message: error?.message || 'No subject id returned' });
    } else {
      success += 1;
    }

    if (i % 10 === 0) {
      process.stdout.write(`\r  Progress: ${i}/${targetCount} (${success} ok, ${failures.length} failed)`);
    }
  }

  console.log(`\n\nDone!`);
  console.log(`  Requested : ${targetCount}`);
  console.log(`  Created   : ${success}`);
  console.log(`  Failed    : ${failures.length}`);

  if (failures.length > 0) {
    console.log('\nSample failures (up to 10):');
    failures.slice(0, 10).forEach((f) => {
      console.log(`  #${f.index} ${f.subjectNumber}: ${f.message}`);
    });
  }

  // Final count check
  const { count: finalCount } = await supabase
    .from('subjects')
    .select('id', { count: 'exact', head: true });
  console.log(`\nTotal subjects in DB now: ${finalCount ?? 0}`);

  if (success === 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nScript failed:', err.message);
  process.exit(1);
});
