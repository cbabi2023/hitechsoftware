# Hitech Software - Frontend Developer Quick Reference

## API Query Patterns by Role & Module

### Recent API Updates (Technician Rejection Workflow)

```javascript
// 1) Technician respond to assigned subject (tech-only)
// POST /api/subjects/:id/respond
// body: { action: 'accept' }
// body: { action: 'reject', rejection_reason: '...' }

// 2) Technician monthly performance (super_admin-only)
// GET /api/team/members/:id/performance
// response.data.monthly => [{ month, label, rejections, reschedules }]
// response.data.totals  => { rejections, reschedules }

// Notes:
// - Rejected subjects now persist status as 'REJECTED'.
// - Subject detail/timeline shows who rejected via actor metadata.
```

---

## 1. SUPER_ADMIN (Joby Sir) - Full Access

### Dashboard Overview
```javascript
// Get complete business overview
const overview = await supabase
  .from('subjects')
  .select('status')
  .then(data => ({
    pending: data.filter(s => s.status === 'PENDING').length,
    in_progress: data.filter(s => s.status === 'IN_PROGRESS').length,
    completed: data.filter(s => s.status === 'COMPLETED').length,
  }));

// Get technician performance
const techMetrics = await supabase
  .from('subjects')
  .select('assigned_technician_id, status, completed_at')
  .gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString())
  .then(data => {
    // Group by technician and count completions
  });

// Financial summary
const revenue = await supabase
  .from('billing')
  .select('grand_total, amount_paid, invoice_date')
  .gte('invoice_date', new Date(Date.now() - 30*24*60*60*1000).toISOString());
```

### Approve/Reject Payments
```javascript
// Approve Brand/Dealer payment
const approvePayment = async (paymentId) => {
  return await supabase
    .from('brand_dealer_payments')
    .update({
      payment_status: 'RECEIVED',
      approval_by: session.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);
};

// Dispute payment
const disputePayment = async (paymentId, reason) => {
  return await supabase
    .from('brand_dealer_payments')
    .update({
      payment_status: 'DISPUTED',
      dispute_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);
};

// Waive payment
const waivePayment = async (paymentId, reason) => {
  return await supabase
    .from('brand_dealer_payments')
    .update({
      payment_status: 'WAIVED',
      waive_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);
};
```

---

## 2. OFFICE_STAFF - Subject & Billing Management

### Create Service Subject
```javascript
const createSubject = async (customerData) => {
  // Generate subject number
  const record = await supabase
    .from('subjects')
    .select('id')
    .gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString())
    .then(d => d.length + 1);

  return await supabase
    .from('subjects')
    .insert({
      subject_number: `SUB-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(record).padStart(4, '0')}`,
      customer_id: customerData.customer_id,
      product_id: customerData.product_id,
      status: 'PENDING',
      job_type: customerData.job_type, // IN_WARRANTY, OUT_OF_WARRANTY, AMC
      description: customerData.description,
      complaint_details: customerData.complaint_details,
      serial_number: customerData.serial_number,
      schedule_date: customerData.schedule_date,
      created_by: session.user.id,
    })
    .select()
    .single();
};

// Fetch today's pending subjects
const getTodaysPending = async () => {
  return await supabase
    .from('subjects')
    .select(`
      *,
      customers(customer_name, phone_number, address),
      products(product_name, brand_name),
      technicians(technician_code)
    `)
    .eq('status', 'PENDING')
    .gte('schedule_date', new Date().toISOString().slice(0,10))
    .lte('schedule_date', new Date().toISOString().slice(0,10))
    .order('schedule_date', { ascending: true });
};
```

### Assign Technician to Subject
```javascript
const assignTechnician = async (subjectId, technicianId) => {
  // Check daily limit (max 10-12 subjects)
  const assignedCount = await supabase
    .from('subjects')
    .select('id')
    .eq('assigned_technician_id', technicianId)
    .eq('schedule_date', new Date().toISOString().slice(0,10))
    .then(d => d.length);

  if (assignedCount >= 12) {
    throw new Error('Technician daily limit (12) reached');
  }

  return await supabase
    .from('subjects')
    .update({
      assigned_technician_id: technicianId,
      status: 'ALLOCATED',
      allocated_at: new Date().toISOString(),
    })
    .eq('id', subjectId);
};
```

### Create Invoice
```javascript
const createInvoice = async (subjectId, lineItems) => {
  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const taxAmount = subtotal * 0.18; // 18% GST
  const grandTotal = subtotal + taxAmount;

  return await supabase
    .from('billing')
    .insert({
      subject_id: subjectId,
      customer_id: customerData.customer_id,
      invoice_date: new Date().toISOString().slice(0,10),
      total_amount: subtotal,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      created_by: session.user.id,
    })
    .select()
    .single()
    .then(async (invoice) => {
      // Add line items
      await supabase
        .from('billing_items')
        .insert(
          lineItems.map(item => ({
            billing_id: invoice.id,
            inventory_id: item.inventory_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.unit_price * item.quantity,
            is_parts: item.is_parts,
            is_oow_parts: item.is_oow_parts,
          }))
        );
      
      return invoice;
    });
};

// Send invoice to Brand/Dealer
const sendToBrandDealer = async (invoiceId) => {
  const invoice = await supabase
    .from('billing')
    .select('*,customers(phone_number)')
    .eq('id', invoiceId)
    .single();

  // Create notification (manual tracking, not automated)
  await supabase
    .from('notifications')
    .insert({
      recipient_phone: invoice.customers.phone_number,
      notification_type: 'INVOICE_SENT',
      message: `Invoice ${invoice.invoice_number} for ₹${invoice.grand_total} - Please make payment.`,
      status: 'PENDING',
      reference_type: 'BILLING',
      reference_id: invoiceId,
    });

  return await supabase
    .from('billing')
    .update({
      is_sent_to_brand_dealer: true,
      sent_at: new Date().toISOString(),
      sent_by: session.user.id,
    })
    .eq('id', invoiceId);
};
```

### Manage Stock
```javascript
// Get current stock levels
const getStockLevels = async () => {
  return await supabase
    .from('stock')
    .select(`
      *,
      inventory(
        item_name,
        item_code,
        category,
        unit_cost,
        mrp_price,
        reorder_level
      )
    `)
    .then(records => 
      records.map(r => ({
        ...r,
        status: r.quantity_on_hand < r.inventory.reorder_level 
          ? 'LOW_STOCK' 
          : 'OK'
      }))
    );
};

// Record stock entry
const recordStockEntry = async (inventoryId, quantity) => {
  // Update stock
  await supabase.rpc('update_stock', {
    p_inventory_id: inventoryId,
    p_quantity: quantity
  });

  // Log transaction
  return await supabase
    .from('stock_transactions')
    .insert({
      inventory_id: inventoryId,
      transaction_type: 'ENTRY',
      quantity: quantity,
      reference_type: 'MANUAL',
      notes: 'Stock entry',
      created_by: session.user.id,
    });
};
```

---

## 3. STOCK_MANAGER - Inventory & Digital Bag

### Manage Digital Bag Daily
```javascript
// Issue bag to technician
const issueBagToTechnician = async (technicianId) => {
  return await supabase
    .from('digital_bag')
    .upsert({
      technician_id: technicianId,
      bag_date: new Date().toISOString().slice(0,10),
      status: 'ACTIVE',
      issued_by: session.user.id,
      total_items_issued: 0,
      total_items_used: 0,
      total_items_returned: 0,
      variance: 0,
      variance_flagged: false,
    }, { 
      onConflict: 'technician_id,bag_date' 
    })
    .select()
    .single();
};

// Add items to bag
const addItemsToBag = async (bagId, items) => {
  // items: [{ inventory_id, quantity_issued }, ...]
  
  // Check total doesn't exceed capacity (50)
  const currentBag = await supabase
    .from('digital_bag_items')
    .select('quantity_issued')
    .eq('digital_bag_id', bagId)
    .then(d => d.reduce((sum, item) => sum + item.quantity_issued, 0));

  const newTotal = currentBag + items.reduce((s, i) => s + i.quantity_issued, 0);
  
  if (newTotal > 50) {
    throw new Error(`Bag capacity exceeded (max 50, attempted ${newTotal})`);
  }

  // Add items
  await supabase
    .from('digital_bag_items')
    .insert(
      items.map(item => ({
        digital_bag_id: bagId,
        inventory_id: item.inventory_id,
        quantity_issued: item.quantity_issued,
        quantity_used: 0,
        quantity_returned: 0,
      }))
    );

  // Update bag totals
  return await supabase
    .from('digital_bag')
    .update({
      total_items_issued: newTotal,
    })
    .eq('id', bagId);
};

// Get pending digital bags
const getPendingBags = async () => {
  return await supabase
    .from('digital_bag')
    .select(`
      *,
      technicians(
        id,
        display_name,
        technician_code
      )
    `)
    .eq('bag_date', new Date().toISOString().slice(0,10))
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true });
};

// Close bag and check variance
const closeBag = async (bagId) => {
  const bag = await supabase
    .from('digital_bag')
    .select('*')
    .eq('id', bagId)
    .single();

  const variance = bag.total_items_issued - bag.total_items_used - bag.total_items_returned;

  // Trigger calculates variance automatically
  return await supabase
    .from('digital_bag')
    .update({
      status: 'CLOSED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bagId)
    .then(async () => {
      // If variance, flag for approval
      if (variance !== 0) {
        await supabase
          .from('notifications')
          .insert({
            recipient_phone: '+919876543210', // Manager's phone
            notification_type: 'BAG_VARIANCE',
            message: `Digital bag variance detected: ${variance} items. Review required.`,
            status: 'PENDING',
            reference_type: 'DIGITAL_BAG',
            reference_id: bagId,
          });
      }
    });
};
```

---

## 4. TECHNICIAN - Mobile App Only

### Check-In/Out
```javascript
// Toggle ON
const toggleOn = async () => {
  const today = new Date().toISOString().slice(0,10);
  
  // Check time (must be between 12:00 AM - 10:30 AM)
  const now = new Date();
  if (now.getHours() >= 10 && now.getMinutes() > 30) {
    throw new Error('Check-in only allowed until 10:30 AM');
  }

  return await supabase
    .from('technician_attendance')
    .upsert({
      technician_id: session.user.id,
      attendance_date: today,
      status: 'ON',
      time_on: now.toLocaleTimeString('en-GB', { hour12: false }),
    }, { 
      onConflict: 'technician_id,attendance_date' 
    })
    .select()
    .single();
};

// Toggle OFF
const toggleOff = async () => {
  const now = new Date();
  
  // Check time (only after 6:00 PM)
  if (now.getHours() < 18) {
    throw new Error('Check-out only allowed after 6:00 PM');
  }

  return await supabase
    .from('technician_attendance')
    .update({
      status: 'OFF',
      time_off: now.toLocaleTimeString('en-GB', { hour12: false }),
    })
    .eq('technician_id', session.user.id)
    .eq('attendance_date', new Date().toISOString().slice(0,10))
    .select()
    .single();
};

// Request leave
const requestLeave = async (leaveDate, reason) => {
  // Max 1 week in advance
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 7);
  
  if (new Date(leaveDate) > maxDate) {
    throw new Error('Leave can only be requested up to 1 week in advance');
  }

  return await supabase
    .from('technician_attendance')
    .upsert({
      technician_id: session.user.id,
      attendance_date: leaveDate,
      status: 'LEAVE',
      leave_reason: reason,
    }, { 
      onConflict: 'technician_id,attendance_date' 
    });
};

// Get my attendance records
const getMyAttendance = async (month) => {
  const startDate = new Date(month).toISOString().slice(0,10);
  const endDate = new Date(new Date(month).setMonth(new Date(month).getMonth() + 1))
    .toISOString()
    .slice(0,10);

  return await supabase
    .from('technician_attendance')
    .select('*')
    .eq('technician_id', session.user.id)
    .gte('attendance_date', startDate)
    .lt('attendance_date', endDate)
    .order('attendance_date', { ascending: false });
};
```

### My Daily Jobs
```javascript
// Get today's assigned subjects
const getMyTodaysSubjects = async () => {
  return await supabase
    .from('subjects')
    .select(`
      *,
      customers(customer_name, phone_number, address, latitude, longitude),
      products(product_name),
      warranty(warranty_end_date, status)
    `)
    .eq('assigned_technician_id', session.user.id)
    .eq('schedule_date', new Date().toISOString().slice(0,10))
    .in('status', ['ALLOCATED', 'ACCEPTED', 'IN_PROGRESS'])
    .order('schedule_date', { ascending: true });
};

// Accept subject
const acceptSubject = async (subjectId) => {
  return await supabase
    .from('subjects')
    .update({
      status: 'ACCEPTED',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', subjectId)
    .eq('assigned_technician_id', session.user.id);
};

// Start work
const startWork = async (subjectId) => {
  return await supabase
    .from('subjects')
    .update({
      status: 'IN_PROGRESS',
    })
    .eq('id', subjectId)
    .eq('assigned_technician_id', session.user.id);
};

// Complete subject (In-Warranty: requires 7 uploads)
const completeInWarrantySubject = async (subjectId, mediaIds) => {
  // Verify 7 required uploads
  const required = ['SERIAL_NUMBER', 'MACHINE', 'BILL', 'JOB_SHEET', 'DEFECTIVE_PART', 'SITE_PHOTO', 'SERVICE_VIDEO'];
  const uploaded = new Set(mediaIds.map(m => m.category));
  
  for (let req of required) {
    if (!uploaded.has(req)) {
      throw new Error(`Missing required upload: ${req}`);
    }
  }

  return await supabase
    .from('subjects')
    .update({
      status: 'COMPLETED',
      is_completed: true,
      actual_completion_date: new Date().toISOString().slice(0,10),
      completed_at: new Date().toISOString(),
    })
    .eq('id', subjectId)
    .eq('assigned_technician_id', session.user.id);
};

// Mark incomplete
const markIncomplete = async (subjectId, reason, remarks) => {
  if (reason === 'OTHER' && !remarks) {
    throw new Error('Remarks required for OTHER reason');
  }

  return await supabase
    .from('subjects')
    .update({
      status: 'INCOMPLETE',
      incompletion_reason: reason,
      incompletion_remarks: remarks,
      actual_completion_date: new Date().toISOString().slice(0,10),
      completed_at: new Date().toISOString(),
    })
    .eq('id', subjectId)
    .eq('assigned_technician_id', session.user.id);
};

// Reschedule subject
const rescheduleSubject = async (subjectId, newDate, reason) => {
  return await supabase
    .from('subjects')
    .update({
      status: 'RESCHEDULED',
      rescheduled_date: newDate,
      rescheduled_reason: reason,
    })
    .eq('id', subjectId)
    .eq('assigned_technician_id', session.user.id);
};
```

### Upload Media
```javascript
// Upload image (max 2MB)
const uploadImage = async (subjectId, category, file) => {
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  
  if (file.size > MAX_SIZE) {
    throw new Error('Image must be less than 2MB');
  }

  const filename = `${subjectId}/${category}/${Date.now()}.jpg`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('subject-media')
    .upload(filename, file);

  if (uploadError) throw uploadError;

  // Get public URL
  const { data } = await supabase.storage
    .from('subject-media')
    .getPublicUrl(filename);

  // Record in DB
  return await supabase
    .from('subject_media')
    .insert({
      subject_id: subjectId,
      media_type: 'IMAGE',
      media_category: category,
      file_name: file.name,
      file_size_bytes: file.size,
      storage_path: filename,
      file_url: data.publicUrl,
      uploaded_by: session.user.id,
    })
    .select()
    .single();
};

// Upload video (max 50MB)
const uploadVideo = async (subjectId, file) => {
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  
  if (file.size > MAX_SIZE) {
    throw new Error('Video must be less than 50MB');
  }

  const filename = `${subjectId}/SERVICE_VIDEO/${Date.now()}.mp4`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('subject-media')
    .upload(filename, file);

  if (uploadError) throw uploadError;

  const { data } = await supabase.storage
    .from('subject-media')
    .getPublicUrl(filename);

  return await supabase
    .from('subject_media')
    .insert({
      subject_id: subjectId,
      media_type: 'VIDEO',
      media_category: 'SERVICE_VIDEO',
      file_name: file.name,
      file_size_bytes: file.size,
      storage_path: filename,
      file_url: data.publicUrl,
      uploaded_by: session.user.id,
    })
    .select()
    .single();
};

// Get uploaded media for subject
const getSubjectMedia = async (subjectId) => {
  return await supabase
    .from('subject_media')
    .select('*')
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false });
};
```

### Digital Bag Checkout
```javascript
// Get my today's bag
const getMyBag = async () => {
  return await supabase
    .from('digital_bag')
    .select(`
      *,
      digital_bag_items(
        *,
        inventory(item_name, item_code, mrp_price)
      )
    `)
    .eq('technician_id', session.user.id)
    .eq('bag_date', new Date().toISOString().slice(0,10))
    .single();
};

// Mark item as used
const markItemUsed = async (bagItemId, quantity) => {
  const item = await supabase
    .from('digital_bag_items')
    .select('quantity_used')
    .eq('id', bagItemId)
    .single();

  return await supabase
    .from('digital_bag_items')
    .update({
      quantity_used: item.quantity_used + quantity,
    })
    .eq('id', bagItemId);
};

// Return item
const returnItem = async (bagItemId, quantity) => {
  const item = await supabase
    .from('digital_bag_items')
    .select('quantity_returned')
    .eq('id', bagItemId)
    .single();

  return await supabase
    .from('digital_bag_items')
    .update({
      quantity_returned: item.quantity_returned + quantity,
    })
    .eq('id', bagItemId);
};

// Close bag at end of day
const closeBag = async () => {
  const bag = await supabase
    .from('digital_bag')
    .select(`
      *,
      digital_bag_items(quantity_issued, quantity_used, quantity_returned)
    `)
    .eq('technician_id', session.user.id)
    .eq('bag_date', new Date().toISOString().slice(0,10))
    .single();

  const totalIssued = bag.digital_bag_items
    .reduce((sum, item) => sum + item.quantity_issued, 0);
  const totalUsed = bag.digital_bag_items
    .reduce((sum, item) => sum + item.quantity_used, 0);
  const totalReturned = bag.digital_bag_items
    .reduce((sum, item) => sum + item.quantity_returned, 0);

  return await supabase
    .from('digital_bag')
    .update({
      total_items_issued: totalIssued,
      total_items_used: totalUsed,
      total_items_returned: totalReturned,
      status: 'CLOSED',
    })
    .eq('id', bag.id);
};
```

### View My Payouts
```javascript
// Get my payouts
const getMyPayouts = async (year = null) => {
  let query = supabase
    .from('payouts')
    .select('*')
    .eq('technician_id', session.user.id);

  if (year) {
    const yearStart = new Date(`${year}-01-01`).toISOString();
    const yearEnd = new Date(`${year}-12-31`).toISOString();
    query = query
      .gte('payout_period_start', yearStart)
      .lte('payout_period_end', yearEnd);
  }

  return await query
    .order('payout_period_end', { ascending: false });
};

// View detailed payout
const getPayout = async (payoutId) => {
  return await supabase
    .from('payouts')
    .select('*')
    .eq('id', payoutId)
    .single();
};
```

---

## Common Patterns

### Error Handling
```javascript
const handleApiError = (error) => {
  if (error.code === '42P01') {
    throw new Error('Table not found - Database schema issue');
  } else if (error.code === '42501') {
    throw new Error('Permission denied - Check RLS policies');
  } else if (error.code === '23505') {
    throw new Error('Duplicate record found');
  } else {
    throw new Error(error.message || 'Unknown error');
  }
};

// Usage:
try {
  await someDbOperation();
} catch (error) {
  handleApiError(error);
}
```

### Real-time Subscriptions
```javascript
// Subscribe to subject status changes
const subscribeToSubjectUpdates = (subjectId, onUpdate) => {
  return supabase
    .from(`subjects:id=eq.${subjectId}`)
    .on('*', (payload) => {
      console.log('Subject updated:', payload.new);
      onUpdate(payload.new);
    })
    .subscribe();
};

// Usage in component:
useEffect(() => {
  const subscription = subscribeToSubjectUpdates(subjectId, (updated) => {
    setSubject(updated);
  });

  return () => subscription.unsubscribe();
}, [subjectId]);
```

### Pagination
```javascript
// Fetch with pagination
const getSubjectsWithPagination = async (page = 0, pageSize = 10) => {
  const start = page * pageSize;
  const end = start + pageSize - 1;

  const { data, count } = await supabase
    .from('subjects')
    .select('*', { count: 'exact' })
    .range(start, end)
    .order('created_at', { ascending: false });

  return {
    data,
    total: count,
    totalPages: Math.ceil(count / pageSize),
    currentPage: page
  };
};
```

---

**Happy Coding!** 🚀
