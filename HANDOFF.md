# Quotation AI – Handoff

עדכון אחרון: 2026-02-23  
פרויקט: `quotation-ai-1934f`  
Cloud Run API: `https://quotation-ai-api-ckaczwaj3q-uc.a.run.app`

## מצב נוכחי (חשוב)
- צד שרת ולקוח רצים תקין מקומית (`typecheck` + `build` עברו).
- יש תמיכה בפריסה ל-Cloud Run + שמירת מסמכים ב-Cloud Storage.
- נוספו פסי התקדמות מפורטים לתהליך אימון (לא רק אחוז אחד כללי).
- נוספה קטלוגציה דינמית לפריטים שלא מתאימים לקטגוריות הסטטיות.
- נוספה עריכת קטגוריה ידנית לכל רכיב במסך "עריכת טופס לקוח", כולל שמירה פר נותן שירות.

## מה בדיוק הושלם בסבב האחרון

### 1) Progress מפורט לאימון
- נשמרים ב-`training_jobs`:
  - `currentStage`
  - `stageProgress` (0-100 לכל שלב)
- UI מציג כמה progress bars לפי שלבים.

קבצים:
- `server/src/types/training.ts`
- `server/src/services/training-stage-progress.service.ts`
- `server/src/services/training-jobs.service.ts`
- `server/src/services/training-learning.service.ts`
- `src/utils/trainingProgress.ts`
- `src/hooks/useQuotationMvp.ts`
- `src/components/quotation/TrainingPanel.tsx`
- `src/styles/components.css`

### 2) קטגוריות דינמיות + override ידני
- אם פריט לא מזוהה ע"י חוקים סטטיים → נוצר שיוך דינמי.
- נותן שירות יכול להגדיר קטגוריה ידנית לרכיב.
- השמירה היא ברמת נותן שירות (לא גלובלית, לא פוגעת באחרים).

קבצים:
- `server/src/services/provider-line-item-categories.service.ts`
- `server/src/services/provider-line-items.service.ts`
- `server/src/services/provider-line-item-overrides.service.ts`
- `server/src/routes/model-line-items.route.ts`
- `server/src/services/provider-line-item-merge.service.ts`
- `src/components/quotation/ClientFormItemsEditorPanel.tsx`
- `src/services/api/modelApi.ts`
- `src/types/quotation.ts`

## מה צריך לעשות עכשיו (לפני אימון 300 קבצים)
1. לפרוס מחדש API ל-Cloud Run (יש שינויים בשרת).
2. לפרוס/לעדכן Frontend (יש שינויים ב-UI).
3. לבדוק ידנית:
   - במסך עריכת רכיבי לקוח, עמודת "קטגוריה" עובדת ושומרת.
   - בסטטוס אימון מוצגים כמה progress bars.
4. רק אחרי זה להתחיל אימון 300 קבצים לגנן.

## פקודות מהירות
### בדיקות מקומיות
```bash
npm --prefix server run typecheck
npm run build
```

### דיפלוי API (Cloud Run)
```powershell
gcloud run deploy quotation-ai-api `
  --source ".\server" `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated `
  --service-account quotation-ai-api@quotation-ai-1934f.iam.gserviceaccount.com `
  --set-secrets OPENAI_API_KEY=openai-api-key:latest `
  --set-env-vars "NODE_ENV=production,WEB_ORIGIN=http://localhost:5173,FIREBASE_PROJECT_ID=quotation-ai-1934f,FIREBASE_STORAGE_BUCKET=quotation-ai-1934f-documents,FIREBASE_USE_ADC=true,UPLOADS_DIR=/tmp/uploads,UPLOADS_MAX_MB=10,CLIENT_FORM_MAX_ITEMS=120,OPENAI_MODEL=gpt-4.1-mini,OPENAI_BASE_URL=https://api.openai.com/v1"
```

### Health check
```powershell
Invoke-WebRequest "https://quotation-ai-api-ckaczwaj3q-uc.a.run.app/api/health"
```

## בדיקות אחרי אימון 300 קבצים
- לוודא שאין כפילויות ברכיבים בטופס לקוח.
- לוודא שרכיבים חדשים נכנסים לקטגוריות נכונות (או דינמיות) ולא "כללי" סתם.
- לוודא שב-`training_jobs` רואים `stageProgress` מתעדכן.
- לאמת תמחור הצעה חדשה מול 2-3 הצעות היסטוריות ידועות.

## סיכונים ידועים
- חוסר נרמול טוב בשמות רכיבים יוצר פיצול itemKey ופוגע באימון.
- override לא נכון לקטגוריה יכול להחזיר פריט לקטגוריה לא מתאימה.
- ריצת אימון ארוכה בלי דיפלוי עדכני תיתן תוצאות לא עקביות מול ה-UI החדש.

## Prompt פתיחה לצ'אט חדש
הדבק את זה כהודעה ראשונה:

```text
היי, תתחיל מ-README.md ו-HANDOFF.md בפרויקט quotation-ai.
אנחנו ממשיכים מאיפה שעצרנו.

מצב נוכחי:
- Cloud Run API: https://quotation-ai-api-ckaczwaj3q-uc.a.run.app
- נוספו multi-progress לאימון ונוספה קטלוגציה דינמית + עריכת קטגוריות ידנית.
- עכשיו אני רוצה לבצע דיפלוי ואז להריץ אימון על 300 קבצים בתחום גינון.

בבקשה:
1) אמת שהשינויים הרלוונטיים קיימים בקוד.
2) תן לי צעד אחד בכל פעם לדיפלוי (API ואז Frontend).
3) אחרי זה תן לי checklist בדיקות לאימון 300 קבצים.
4) אם יש פער שמסכן את האימון, תעצור ותכתוב לי בדיוק מה לתקן לפני הריצה.
```
