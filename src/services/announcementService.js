// Announcements Service - RBAC enforced
// Uses global 'db' and functions from global scope

/**
 * Get all announcements visible to teacher
 */
const getAnnouncementsForTeacher = async (user) => {
  if (!isTeacher(user)) {
    throw new Error('Access denied: Only teachers can view announcements');
  }

  try {
    // Get admin announcements
    const adminAnnouncementsSnapshot = await window.db.collection('announcements')
      .where('type', '==', 'admin')
      .where('visibility', '==', 'all')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    // Get announcements for assigned classes
    const classAnnouncementsSnapshot = await window.db.collection('announcements')
      .where('type', '==', 'class')
      .where('classIds', 'array-contains-any', user.assignedClasses || [])
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    // Get announcements by same teacher
    const teacherAnnouncementsSnapshot = await window.db.collection('announcements')
      .where('type', '==', 'teacher')
      .where('authorId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const allAnnouncements = [
      ...adminAnnouncementsSnapshot.docs,
      ...classAnnouncementsSnapshot.docs,
      ...teacherAnnouncementsSnapshot.docs,
    ]
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return allAnnouncements;
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
// Expose functions globally
window.getAnnouncementsForTeacher = getAnnouncementsForTeacher;
window.postTeacherAnnouncement = postTeacherAnnouncement;
window.updateAnnouncement = updateAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.markAnnouncementAsRead = markAnnouncementAsRead;
window.getUnreadAnnouncementCount = getUnreadAnnouncementCount;