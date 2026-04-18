import { openDB } from 'idb';

class OfflineStorage {
  constructor() {
    this.dbName = 'FisheriesOfflineDB';
    this.dbVersion = 1;
    this.db = null;
    this.initDB();
  }

  async initDB() {
    this.db = await openDB(this.dbName, this.dbVersion, {
      upgrade(db) {
        // Store for pending records that need to be synced
        if (!db.objectStoreNames.contains('pendingRecords')) {
          const store = db.createObjectStore('pendingRecords', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          store.createIndex('synced', 'synced');
          store.createIndex('timestamp', 'timestamp');
        }
        
        // Store for synced records cache
        if (!db.objectStoreNames.contains('syncedRecords')) {
          const store = db.createObjectStore('syncedRecords', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          store.createIndex('date', 'date');
        }
        
        // Store for offline data entry drafts
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
      },
    });
    return this.db;
  }

  // Save record for offline (will sync later)
  async savePendingRecord(recordData) {
    const db = await this.initDB();
    const record = {
      ...recordData,
      timestamp: new Date().toISOString(),
      synced: false,
      retryCount: 0
    };
    const id = await db.add('pendingRecords', record);
    return id;
  }

  // Get all pending records to sync
  async getPendingRecords() {
    try {
      const db = await this.initDB();
      // Use getAll on the store directly instead of index
      const allRecords = await db.getAll('pendingRecords');
      // Filter for unsynced records
      const pendingRecords = allRecords.filter(record => record.synced === false);
      return pendingRecords;
    } catch (error) {
      console.error('Error getting pending records:', error);
      return [];
    }
  }

  // Mark record as synced
  async markAsSynced(id) {
    const db = await this.initDB();
    const record = await db.get('pendingRecords', id);
    if (record) {
      record.synced = true;
      await db.put('pendingRecords', record);
      
      // Move to synced cache
      await db.add('syncedRecords', record);
    }
  }

  // Delete pending record (after successful sync or if cancelled)
  async deletePendingRecord(id) {
    const db = await this.initDB();
    await db.delete('pendingRecords', id);
  }

  // Save draft form data
  async saveDraft(draftId, formData) {
    const db = await this.initDB();
    await db.put('drafts', { id: draftId, data: formData, timestamp: new Date().toISOString() });
  }

  // Get draft form data
  async getDraft(draftId) {
    const db = await this.initDB();
    const draft = await db.get('drafts', draftId);
    return draft?.data || null;
  }

  // Delete draft
  async deleteDraft(draftId) {
    const db = await this.initDB();
    await db.delete('drafts', draftId);
  }

  // Get all pending count
  async getPendingCount() {
    const records = await this.getPendingRecords();
    return records.length;
  }

  // Clear all offline data
  async clearAll() {
    const db = await this.initDB();
    await db.clear('pendingRecords');
    await db.clear('syncedRecords');
    await db.clear('drafts');
  }
}

// Create and export a single instance
const offlineStorage = new OfflineStorage();
export default offlineStorage;