// Announcements Service - RBAC enforced
// Uses global 'db' and functions from global scope

/**
 * Get all announcements for users (visible to both teachers and admins)
 */
const getAllAnnouncements = async () => {
  try {
    const announcementsSnapshot = await window.db.collection('announcements')
      .orderBy('createdAt', 'desc')
      .get();

    return announcementsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch announcements: ${error.message}`);
  }
};

/**
 * Post announcement by admin (visible to everyone)
 */
const postAdminAnnouncement = async (user, announcementData) => {
  if (!user || user.role !== 'admin') {
    throw new Error('Access denied: Only admins can post announcements');
  }

  try {
    const announcement = {
      type: 'admin',
      title: announcementData.title,
      content: announcementData.content,
      authorId: user.uid,
      authorName: user.name || 'Admin',
      authorRole: 'admin',
      visibility: 'all',
      createdAt: window.firebase.firestore.Timestamp.now(),
      updatedAt: window.firebase.firestore.Timestamp.now(),
      isPinned: false,
    };

    const docRef = await window.db.collection('announcements').add(announcement);

    return {
      success: true,
      announcementId: docRef.id,
      message: 'Announcement posted successfully',
    };
  } catch (error) {
    throw new Error(`Failed to post announcement: ${error.message}`);
  }
};

/**
 * Get all announcements visible to teacher
 */
const getAnnouncementsForTeacher = async (user) => {
  if (!user || user.role !== 'teacher') {
    throw new Error('Access denied: Only teachers can view announcements');
  }

  try {
    const announcementsSnapshot = await window.db.collection('announcements')
      .where('visibility', '==', 'all')
      .orderBy('createdAt', 'desc')
      .get();

    return announcementsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch announcements: ${error.message}`);
  }
};

/**
 * Post announcement to assigned classes (teacher only)
 */
const postTeacherAnnouncement = async (user, announcementData) => {
  if (!isTeacher(user)) {
    throw new Error('Access denied: Only teachers can post announcements');
  }

  // Verify teacher is assigned to all target classes
  const classIds = announcementData.classIds || [];
  const assignedClasses = user.assignedClasses || [];

  const hasAccess = classIds.every((classId) => assignedClasses.includes(classId));
  if (!hasAccess) {
    throw new Error('Access denied: Cannot post to classes you are not assigned to');
  }

  try {
    const announcementId = `${user.uid}_${Date.now()}`;
    const announcement = {
      id: announcementId,
      type: 'teacher',
      title: announcementData.title,
      content: announcementData.content,
      classIds,
      authorId: user.uid,
      authorName: user.name,
      authorRole: 'teacher',
      visibility: 'class',
      createdAt: window.firebase.firestore.Timestamp.now(),
      updatedAt: window.firebase.firestore.Timestamp.now(),
      isPinned: false,
    };

    await window.db.collection('announcements').doc(announcementId).set(announcement);

    return {
      success: true,
      announcementId,
      message: 'Announcement posted successfully',
    };
  } catch (error) {
    throw new Error(`Failed to post announcement: ${error.message}`);
  }
};

/**
 * Update announcement (teacher can only update their own)
 */
const updateAnnouncement = async (user, announcementId, updateData) => {
  try {
    const announcementDocRef = window.db.collection('announcements').doc(announcementId);
    const announcementDocSnapshot = await announcementDocRef.get();

    if (!announcementDocSnapshot.exists) {
      throw new Error('Announcement not found');
    }

    const announcement = announcementDocSnapshot.data();

    // Only author can update
    if (announcement.authorId !== user.uid) {
      throw new Error('Access denied: Cannot edit other teachers announcements');
    }

    const update = {
      title: updateData.title || announcement.title,
      content: updateData.content || announcement.content,
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    await announcementDocRef.update(update);

    return {
      success: true,
      message: 'Announcement updated successfully',
    };
  } catch (error) {
    throw new Error(`Failed to update announcement: ${error.message}`);
  }
};

/**
 * Delete announcement (teacher can only delete their own)
 */
const deleteAnnouncement = async (user, announcementId) => {
  try {
    const announcementDocSnapshot = await window.db.collection('announcements').doc(announcementId).get();

    if (!announcementDocSnapshot.exists) {
      throw new Error('Announcement not found');
    }

    const announcement = announcementDocSnapshot.data();

    // Only author can delete
    if (announcement.authorId !== user.uid) {
      throw new Error('Access denied: Cannot delete other teachers announcements');
    }

    await window.db.collection('announcements').doc(announcementId).delete();

    return {
      success: true,
      message: 'Announcement deleted successfully',
    };
  } catch (error) {
    throw new Error(`Failed to delete announcement: ${error.message}`);
  }
};

/**
 * Mark announcement as read
 */
const markAnnouncementAsRead = async (user, announcementId) => {
  try {
    const readId = `${user.uid}_${announcementId}`;
    const readRecord = {
      userId: user.uid,
      announcementId,
      readAt: window.firebase.firestore.Timestamp.now(),
    };

    await window.db.collection('announcementReads').doc(readId).set(readRecord);

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to mark announcement as read: ${error.message}`);
  }
};

/**
 * Get unread announcement count
 */
const getUnreadAnnouncementCount = async (user) => {
  try {
    const allAnnouncements = await getAnnouncementsForTeacher(user);
    
    const readSnapshot = await window.db.collection('announcementReads')
      .where('userId', '==', user.uid)
      .get();

    const readIds = new Set(readSnapshot.docs.map((doc) => doc.data().announcementId));
    const unreadCount = allAnnouncements.filter((ann) => !readIds.has(ann.id)).length;

    return unreadCount;
  } catch (error) {
    throw new Error(`Failed to get unread count: ${error.message}`);
  }
};

/**
 * Get count of announcements from last 24 hours
 */
const getRecentAnnouncementCount = async () => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const timestamp = window.firebase.firestore.Timestamp.fromDate(twentyFourHoursAgo);

    const recentSnapshot = await window.db.collection('announcements')
      .where('createdAt', '>=', timestamp)
      .get();

    return recentSnapshot.docs.length;
  } catch (error) {
    throw new Error(`Failed to get recent announcement count: ${error.message}`);
  }
};

// Expose functions globally
window.getAllAnnouncements = getAllAnnouncements;
window.postAdminAnnouncement = postAdminAnnouncement;
window.getAnnouncementsForTeacher = getAnnouncementsForTeacher;
window.postTeacherAnnouncement = postTeacherAnnouncement;
window.updateAnnouncement = updateAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.markAnnouncementAsRead = markAnnouncementAsRead;
window.getUnreadAnnouncementCount = getUnreadAnnouncementCount;
window.getRecentAnnouncementCount = getRecentAnnouncementCount;