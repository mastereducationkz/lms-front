// Re-export all domain modules
export * from './auth';
export * from './courses';
export * from './modules';
export * from './lessons';
export * from './assignments';
export * from './assignment-zero';
export * from './progress';
export * from './chat';
export * from './quizzes';
export * from './events';
export * from './uploads';
export * from './users';
export * from './groups';
export * from './analytics';
export * from './curator';
export * from './flashcards';
export * from './gamification';
export * from './head-teacher';
export * from './lesson-requests';
export * from './admin';
export * from './lectures';
export * from './daily-questions';

// Re-export client utilities for direct access
export { api, API_BASE_URL } from './client';

// Import all functions to build the apiClient object
import { login, logout, getCurrentUser, updateProfile, isAuthenticated, getCurrentUserSync, completeOnboarding } from './auth';
import { CookieUtils } from './client';

function _setCurrentUser(user: any): void {
  CookieUtils.setCookie('current_user', JSON.stringify(user), 7);
  localStorage.removeItem('current_user');
}

function _getCurrentUserFromStorage(): any {
  try {
    let userData = CookieUtils.getCookie('current_user');
    if (!userData) {
      userData = localStorage.getItem('current_user');
    }
    return userData ? JSON.parse(userData) : null;
  } catch { return null; }
}
import { getCourses, getCourse, createCourse, updateCourse, publishCourse, unpublishCourse, setCourseThumbnailUrl, uploadCourseThumbnail, deleteCourse, enrollInCourse, unenrollFromCourse, getMyCourses, autoEnrollStudents, grantGroupAccess, revokeGroupAccess, getCourseGroupAccessStatus, getCourseTeacherAccess, grantCourseTeacherAccess, revokeCourseTeacherAccess, getTeacherCourses, getCourseLessons, getCourseLessonsTyped, fixLessonOrder, addSummaryStepsToCourse, analyzeSatImage, fetchCourses, fetchCourseById } from './courses';
import { getCourseModules, createModule, updateModule, deleteModule, fetchModulesByCourse, fetchModuleById, getModuleProgress } from './modules';
import { getModuleLessons, getLesson, checkLessonAccess, getLessonTyped, createLesson, updateLesson, deleteLesson, splitLesson, getLessonSteps, createStep, getStep, updateStep, deleteStep, reorderSteps, uploadStepAttachment, deleteStepAttachment, fetchLesson, fetchLectureById } from './lessons';
import { getAssignments, getAssignment, getAssignedLessonsForCourse, createAssignment, updateAssignment, submitAssignment, getMySubmissions, getUnseenGradedCount, markSubmissionSeen, getAssignmentSubmissions, getSubmission, debugSubmissions, debugDeleteSubmission, gradeSubmission, toggleAssignmentVisibility, grantExtension, getAssignmentExtensions, revokeExtension, getMyExtension, getAssignmentStatusForStudent, getAssignmentStudentProgress, allowResubmission, getPendingSubmissions, getRecentSubmissions, getTeacherStudentsProgress } from './assignments';
import { getAssignmentZeroStatus, getMyAssignmentZeroSubmission, saveAssignmentZeroProgress, submitAssignmentZero, uploadAssignmentZeroScreenshot, getAllAssignmentZeroSubmissions, getAssignmentZeroSubmissionByUser } from './assignment-zero';
import { markLessonComplete, startLesson, getMyProgress, getCourseProgress, isLessonCompleted, markStepStarted, markStepVisited, getStepProgress, getLessonStepsProgress, getCourseStudentsStepsProgress, getStudentProgressOverview, getStudentProgressOverviewById, getDailyStreak, getStudentProgress, getProgressStudents, markLectureComplete, isLectureCompleted, getCourseProgressLegacy, getCourseStatus } from './progress';
import { getUnreadMessageCount, fetchThreads, fetchMessages, sendMessage, getAvailableContacts, markMessageAsRead, markAllMessagesAsRead } from './chat';
import { fetchQuizzes, fetchQuizById, getQuizAttemptsLeft, submitQuiz, saveQuizAttempt, updateQuizAttempt, gradeQuizAttempt, deleteQuizAttempt, getUngradedQuizAttempts, getGradedQuizAttempts, getLessonQuizSummary, getStepQuizAttempts, getCourseQuizAttempts, getCourseQuizAnalytics, getStudentQuizAnalytics } from './quizzes';
import { getAllEvents, createEvent, createCuratorEvent, updateEvent, deleteEvent, bulkDeleteEvents, createBulkEvents, getMyEvents, getCalendarEvents, getUpcomingEvents, getEventDetails, registerForEvent, unregisterFromEvent, getEventParticipants, updateEventAttendance } from './events';
import { uploadAssignmentFile, uploadTeacherFile, uploadSubmissionFile, uploadQuestionMedia, downloadFile, getFileUrl, uploadFile } from './uploads';
import { getUsers, updateUser, deactivateUser, assignUserToGroup, bulkAssignUsersToGroup, createUser, bulkCreateUsersFromText, resetUserPassword, getAllTeachers } from './users';
import { getAllGroups, getGroups, getMyGroups, getTeacherGroups, getCourseGroups, grantCourseAccessToGroup, revokeCourseAccessFromGroup, createGroup, updateGroup, deleteGroup, assignTeacherToGroup, getGroupStudents, addStudentToGroup, removeStudentFromGroup, bulkAddStudentsToGroup } from './groups';
import { getDetailedStudentAnalytics, getCourseAnalyticsOverview, getVideoEngagementAnalytics, getQuizPerformanceAnalytics, getQuizErrors, getAllStudentsAnalytics, getGroupsAnalytics, getCourseGroupsAnalytics, getCourseProgressHistory, getGroupStudentsAnalytics, getStudentProgressHistory, exportStudentReport, exportGroupReport, exportAllStudentsReport, exportAnalyticsExcel, getStudentDetailedProgress, getStudentSatScores, getStudentLearningPath } from './analytics';
import { getCuratorPendingSubmissions, getCuratorRecentSubmissions, getCuratorStudentsProgress, getCuratorAssignmentsAnalytics, getCuratorHomeworkByGroup, getCuratorGroups, getGroupSchedule, getGroupLeaderboard, getWeeklyLessonsWithHwStatus, getGroupFullAttendanceMatrix, updateLeaderboardConfig, updateAttendanceBulk, updateLeaderboardEntry, updateAttendance, generateSchedule, getGroupSchedules, bulkScheduleUpload, getCuratorDetails, getCuratorTasks, getCuratorTaskGroups, getCuratorTasksSummary, updateCuratorTask, bulkUpdateCuratorTasks, getCuratorTaskTemplates, seedCuratorTaskTemplates, generateWeeklyTasks, getAllCuratorTasks, getCuratorsSummary, createCuratorTaskInstance } from './curator';
import { addFavoriteFlashcard, getFavoriteFlashcards, removeFavoriteFlashcard, removeFavoriteByCardId, checkIsFavorite, lookupWord, quickCreateFlashcard, getVocabularyCards } from './flashcards';
import { getGamificationStatus, getBonusAllowance, giveTeacherBonus, getGamificationLeaderboard, getPointHistory, getStudentLeaderboard } from './gamification';
import { getHeadTeacherManagedCourses, getHeadTeacherCourseTeachers, getHeadTeacherTeacherDetails, getHeadTeacherTeacherFeedbacks, getHeadTeacherTeacherAssignments } from './head-teacher';
import { getLessonRequests, getMyLessonRequests, getIncomingRequests, createLessonRequest, approveLessonRequest, rejectLessonRequest, confirmLessonRequest, declineLessonRequest, getAvailableTeachers, updateSubstitutionPreference } from './lesson-requests';
import { getDashboardStats, getRecentActivity, updateStudyTime, getAdminDashboard, getAdminStats, completeStepsForUser, resetStepsForUser, getUserProgressSummary, reportQuestionError, getQuestionErrorReports, getQuestionErrorReportDetail, updateQuestionErrorReportStatus, updateQuestion, manualUnlockLesson, manualLockLesson, getManualUnlocks, getStudentsJournal, getStudentJournalGroups, getStudentProfile } from './admin';
import { fetchModules, fetchLectures, createLecture, deleteLecture, updateLecture, fetchLecturesByModule } from './lectures';
import { getDailyQuestionsStatus, getDailyQuestionsRecommendations, completeDailyQuestions } from './daily-questions';

const apiClient = {
  // Auth
  login, logout, getCurrentUser, updateProfile, isAuthenticated, getCurrentUserSync, completeOnboarding,
  // Dashboard
  getDashboardStats, getRecentActivity, updateStudyTime,
  // Courses
  getCourses, getCourse, createCourse, updateCourse, publishCourse, unpublishCourse,
  setCourseThumbnailUrl, uploadCourseThumbnail, deleteCourse, enrollInCourse, unenrollFromCourse,
  getMyCourses, autoEnrollStudents, grantGroupAccess, revokeGroupAccess, getCourseGroupAccessStatus,
  getCourseTeacherAccess, grantCourseTeacherAccess, revokeCourseTeacherAccess,
  getTeacherCourses, getCourseLessons, getCourseLessonsTyped, fixLessonOrder,
  addSummaryStepsToCourse, analyzeSatImage, fetchCourses, fetchCourseById,
  // Modules
  getCourseModules, createModule, updateModule, deleteModule, fetchModulesByCourse, fetchModuleById, getModuleProgress,
  // Lessons & Steps
  getModuleLessons, getLesson, checkLessonAccess, getLessonTyped, createLesson, updateLesson, deleteLesson, splitLesson,
  getLessonSteps, createStep, getStep, updateStep, deleteStep, reorderSteps,
  uploadStepAttachment, deleteStepAttachment, fetchLesson, fetchLectureById,
  // Assignments
  getAssignments, getAssignment, getAssignedLessonsForCourse, createAssignment, updateAssignment,
  submitAssignment, getMySubmissions, getUnseenGradedCount, markSubmissionSeen,
  getAssignmentSubmissions, getSubmission, debugSubmissions, debugDeleteSubmission,
  gradeSubmission, toggleAssignmentVisibility, grantExtension, getAssignmentExtensions,
  revokeExtension, getMyExtension, getAssignmentStatusForStudent, getAssignmentStudentProgress,
  allowResubmission, getPendingSubmissions, getRecentSubmissions, getTeacherStudentsProgress,
  // Assignment Zero
  getAssignmentZeroStatus, getMyAssignmentZeroSubmission, saveAssignmentZeroProgress,
  submitAssignmentZero, uploadAssignmentZeroScreenshot,
  getAllAssignmentZeroSubmissions, getAssignmentZeroSubmissionByUser,
  // Progress
  markLessonComplete, startLesson, getMyProgress, getCourseProgress, isLessonCompleted,
  markStepStarted, markStepVisited, getStepProgress, getLessonStepsProgress,
  getCourseStudentsStepsProgress, getStudentProgressOverview, getStudentProgressOverviewById,
  getDailyStreak, getStudentProgress, getProgressStudents,
  markLectureComplete, isLectureCompleted, getCourseProgressLegacy, getCourseStatus,
  // Chat
  getUnreadMessageCount, fetchThreads, fetchMessages, sendMessage,
  getAvailableContacts, markMessageAsRead, markAllMessagesAsRead,
  // Quizzes
  fetchQuizzes, fetchQuizById, getQuizAttemptsLeft, submitQuiz,
  saveQuizAttempt, updateQuizAttempt, gradeQuizAttempt, deleteQuizAttempt,
  getUngradedQuizAttempts, getGradedQuizAttempts, getLessonQuizSummary,
  getStepQuizAttempts, getCourseQuizAttempts, getCourseQuizAnalytics, getStudentQuizAnalytics,
  // Events
  getAllEvents, createEvent, createCuratorEvent, updateEvent, deleteEvent,
  bulkDeleteEvents, createBulkEvents, getMyEvents, getCalendarEvents, getUpcomingEvents,
  getEventDetails, registerForEvent, unregisterFromEvent,
  getEventParticipants, updateEventAttendance,
  // Uploads
  uploadAssignmentFile, uploadTeacherFile, uploadSubmissionFile, uploadQuestionMedia,
  downloadFile, getFileUrl, uploadFile,
  // Users
  getUsers, updateUser, deactivateUser, assignUserToGroup, bulkAssignUsersToGroup,
  createUser, bulkCreateUsersFromText, resetUserPassword, getAllTeachers,
  // Groups
  getAllGroups, getGroups, getMyGroups, getTeacherGroups, getCourseGroups,
  grantCourseAccessToGroup, revokeCourseAccessFromGroup,
  createGroup, updateGroup, deleteGroup, assignTeacherToGroup, getGroupStudents,
  addStudentToGroup, removeStudentFromGroup, bulkAddStudentsToGroup,
  // Analytics
  getDetailedStudentAnalytics, getCourseAnalyticsOverview, getVideoEngagementAnalytics,
  getQuizPerformanceAnalytics, getQuizErrors, getAllStudentsAnalytics,
  getGroupsAnalytics, getCourseGroupsAnalytics, getCourseProgressHistory,
  getGroupStudentsAnalytics, getStudentProgressHistory,
  exportStudentReport, exportGroupReport, exportAllStudentsReport, exportAnalyticsExcel,
  getStudentDetailedProgress, getStudentSatScores, getStudentLearningPath,
  // Curator
  getCuratorPendingSubmissions, getCuratorRecentSubmissions, getCuratorStudentsProgress,
  getCuratorAssignmentsAnalytics, getCuratorHomeworkByGroup, getCuratorGroups,
  getGroupSchedule, getGroupLeaderboard, getWeeklyLessonsWithHwStatus,
  getGroupFullAttendanceMatrix, updateLeaderboardConfig, updateAttendanceBulk,
  updateLeaderboardEntry, updateAttendance, generateSchedule, getGroupSchedules,
  bulkScheduleUpload, getCuratorDetails, getCuratorTasks, getCuratorTaskGroups,
  getCuratorTasksSummary, updateCuratorTask, bulkUpdateCuratorTasks,
  getCuratorTaskTemplates, seedCuratorTaskTemplates, generateWeeklyTasks,
  getAllCuratorTasks, getCuratorsSummary, createCuratorTaskInstance,
  // Flashcards & Vocabulary
  addFavoriteFlashcard, getFavoriteFlashcards, removeFavoriteFlashcard,
  removeFavoriteByCardId, checkIsFavorite, lookupWord, quickCreateFlashcard, getVocabularyCards,
  // Gamification
  getGamificationStatus, getBonusAllowance, giveTeacherBonus,
  getGamificationLeaderboard, getPointHistory, getStudentLeaderboard,
  // Head Teacher
  getHeadTeacherManagedCourses, getHeadTeacherCourseTeachers,
  getHeadTeacherTeacherDetails, getHeadTeacherTeacherFeedbacks, getHeadTeacherTeacherAssignments,
  // Lesson Requests
  getLessonRequests, getMyLessonRequests, getIncomingRequests, createLessonRequest,
  approveLessonRequest, rejectLessonRequest, confirmLessonRequest, declineLessonRequest,
  getAvailableTeachers, updateSubstitutionPreference,
  // Admin
  getAdminDashboard, getAdminStats, completeStepsForUser, resetStepsForUser,
  getUserProgressSummary, reportQuestionError, getQuestionErrorReports,
  getQuestionErrorReportDetail, updateQuestionErrorReportStatus, updateQuestion,
  manualUnlockLesson, manualLockLesson, getManualUnlocks,
  getStudentsJournal, getStudentJournalGroups, getStudentProfile,
  // Lectures (legacy)
  fetchModules, fetchLectures, createLecture, deleteLecture, updateLecture, fetchLecturesByModule,
  // Daily Questions
  getDailyQuestionsStatus, getDailyQuestionsRecommendations, completeDailyQuestions,
  setCurrentUser: _setCurrentUser,
  getCurrentUserFromStorage: _getCurrentUserFromStorage,
};

export default apiClient;
