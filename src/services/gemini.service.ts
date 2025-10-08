import { Injectable } from '@angular/core';
import { GoogleGenerativeAI, GenerateContentRequest } from '@google/generative-ai';
import { ConditionGroup } from '../plan-task.types';
import type { AiResult } from '../components/plan-task-editor/plan-task-editor.component';

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private ai: GoogleGenerativeAI | null = null;
  private apiKey: string | null;

  constructor() {
    // Read API key from safe browser-friendly sources
    const win = typeof window !== 'undefined' ? (window as any) : {};
    const fromWindow = typeof win.GENAI_API_KEY === 'string' ? (win.GENAI_API_KEY as string) : null;
    const fromLocalStorage = typeof localStorage !== 'undefined' ? (localStorage.getItem('GENAI_API_KEY') || null) : null;

    this.apiKey = fromWindow || fromLocalStorage;

    if (this.apiKey) {
      // Initialize SDK only when a key is available
      this.ai = new GoogleGenerativeAI(this.apiKey);
    }
  }

  isConfigured(): boolean {
    return !!this.ai;
  }

  configure(key: string) {
    if (!key) return;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('GENAI_API_KEY', key);
      }
    } catch {}
    this.apiKey = key;
    this.ai = new GoogleGenerativeAI(key);
  }


  async generateConditionGroups(
    userPrompt: string,
    schemaConfig: any,
    dynamicValues: any[]
  ): Promise<AiResult> {
    const responseSchema = {
      type: "OBJECT",
      properties: {
        isValidRequest: { type: "BOOLEAN", description: 'True if the user request is clear and can be mapped to the provided schema. False if ambiguous or impossible.' },
        clarification: { type: "STRING", description: 'If isValidRequest is false, provide a question to the user to clarify their request. Otherwise, this should be null.' },
        taskName: { type: "STRING", description: 'A short, clear name for the task based on the user request. Example: "Check for Published Syllabus". This should be null if isValidRequest is false.' },
        conditionGroups: {
          type: "ARRAY",
          description: 'An array of condition groups that satisfy the user request. This should be null if isValidRequest is false.',
          items: {
            type: "OBJECT",
            properties: {
              conditions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    groupType: { type: "STRING" },
                    source: { type: "STRING" },
                    property: { type: "STRING" },
                    operator: { type: "STRING" },
                    value: { type: "STRING" },
                    subConditions: {
                      type: "ARRAY",
                      nullable: true,
                      items: {
                        type: "OBJECT",
                        properties: {
                          property: { type: "STRING" },
                          operator: { type: "STRING" },
                          value: { type: "STRING" },
                        },
                        required: ['property', 'operator']
                      }
                    }
                  },
                  required: ['groupType', 'source', 'property', 'operator']
                }
              }
            },
            required: ['conditions']
          }
        }
      },
      required: ['isValidRequest', 'clarification', 'taskName', 'conditionGroups']
    };

    const systemInstruction = `
You are an intelligent assistant that helps configure validation rules for a syllabus management system.
Your goal is to translate a user's natural language request into a structured JSON object that defines validation logic.
You MUST strictly adhere to the provided JSON schema for your output.
Here is the exact JSON schema you must follow for the response:
${JSON.stringify(responseSchema, null, 2)}

You can ONLY use the data sources, properties, operators, and dynamic values provided below. Do not invent new ones.

Here are the available options for building conditions:
${JSON.stringify(schemaConfig, null, 2)}

Here are available dynamic values that can be used in the 'value' field:
${JSON.stringify(dynamicValues, null, 2)}

**Critical Rule: Understanding and Using Sub-conditions**

Sub-conditions are the most important part of this task. They are used to filter a list of items *before* applying a check on that list. You must use them when the user's request involves a property that acts on an aggregation (like 'Total Count', 'Total Points') but has a qualifying clause (e.g., "of published assignments", "where the name contains 'welcome'").

**How to identify the need for a sub-condition:**
Look for phrases like "where...", "that are...", "with the name...", "of type..." that filter a larger group.

**Example 1: Counting specific items**
User prompt: "Check if there are more than 5 published assignments."

1.  **Identify the main condition:** The core check is on the "Total Count" of assignments. This is your main property.
    *   \`groupType\`: 'LMS Condition'
    *   \`source\`: 'Assignments'
    *   \`property\`: 'Total Count'
    *   \`operator\`: 'Is greater than'
    *   \`value\`: '5'

2.  **Identify the filter:** The user doesn't want all assignments, only the "published" ones. This is your sub-condition. The \`subConditionProperties\` for 'Total Count' of 'Assignments' will contain 'Publish State'.
    *   \`subConditions\`: \`[{ property: 'Publish State', operator: 'Is', value: 'Published' }]\`

3.  **Combine them:** The sub-condition goes *inside* the main condition object.

**Example 2: Counting items based on a name**
User prompt: "Ensure there is at least 1 assignment with 'welcome' in the name."

1.  **Identify the main condition:** The check is on the "Total Count" of assignments.
    *   \`groupType\`: 'LMS Condition'
    *   \`source\`: 'Assignments'
    *   \`property\`: 'Total Count'
    *   \`operator\`: 'Is greater than or equal to'
    *   \`value\`: '1'

2.  **Identify the filter:** The filter is "with 'welcome' in the name". The \`subConditionProperties\` for 'Total Count' of 'Assignments' will contain 'Name'.
    *   \`subConditions\`: \`[{ property: 'Name', operator: 'Contains', value: 'welcome' }]\`

**Example 3: Checking for the presence of a specific component**
User prompt: "The syllabus must have the 'Instructor Information' component, and it must be visible."

1.  **Identify the main condition:** The check is on the *presence* of a component.
    *   \`groupType\`: 'Syllabus condition'
    *   \`source\`: 'Component by name'
    *   \`property\`: 'Instructor Information'
    *   \`operator\`: 'Is present'

2.  **Identify the filter:** The component must be "visible". The \`subConditionProperties\` for 'Instructor Information' will contain 'Visible'.
    *   \`subConditions\`: \`[{ property: 'Visible', operator: 'Is', value: 'Visible' }]\`

**General Rules:**
- If the user's request is clear and can be fulfilled using the options above, set 'isValidRequest' to true and build the 'conditionGroups' array. Also, generate a concise 'taskName'.
- If the user's request is ambiguous, impossible, or requires options not listed, set 'isValidRequest' to false, and provide a clarifying question in the 'clarification' field. Do not generate conditionGroups.
- Always check the \`subConditionProperties\` in the schema for a given property to see what sub-conditions are available. If \`subConditionProperties\` exists, you can filter using those properties.
- Combine related checks into a single condition group with 'AND' logic. Use multiple condition groups for 'OR' logic.
- The value for any condition or sub-condition should be a string. For numeric values, just provide the number as a string (e.g., "5").
    `;

    // Get the generative model
    if (!this.ai) {
      throw new Error('AI is not configured. Add your Google Generative AI API key to localStorage as GENAI_API_KEY or set window.GENAI_API_KEY at runtime.');
    }

    const model = this.ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction,
    });

    const request: GenerateContentRequest = {
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',

        temperature: 0.2,
      },
    };

    const result = await model.generateContent(request);

    const response = result.response;
    const jsonString = response.text();
    return JSON.parse(jsonString) as AiResult;
  }

  async generateSimpleTaReply(userPrompt: string, courseContext: string, temperature: number = 0.3): Promise<string> {
    if (!this.ai) {
      throw new Error('AI is not configured.');
    }

    const systemInstruction = `You are "Simple TA", a helpful assistant for a single student. Use the provided course and syllabus context to answer questions about due dates, grading, topics, and objectives. If details are not present in the context, say so briefly and provide a concise, general answer.`;

    const model = this.ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
    });

    const request: GenerateContentRequest = {
      contents: [{
        role: 'user',
        parts: [{
          text: `Context (course + syllabus):\n${courseContext}\n\nStudent question:\n${userPrompt}\n\nAnswer concisely (2-4 sentences).`
        }]
      }],
      generationConfig: {
        temperature,
      }
    };

    const result = await model.generateContent(request);
    return result.response.text();
  }

  // Best-effort streaming; falls back to non-streaming if unsupported
  async generateSimpleTaReplyStream(
    userPrompt: string,
    courseContext: string,
    onChunk: (text: string) => void,
    temperature: number = 0.3
  ): Promise<string> {
    if (!this.ai) {
      throw new Error('AI is not configured.');
    }

    const systemInstruction = `You are "Simple TA", a helpful assistant for a single student. Use the provided course and syllabus context to answer questions about due dates, grading, topics, and objectives. If details are not present in the context, say so briefly and provide a concise, general answer.`;

    const model = this.ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
    });

    const request: GenerateContentRequest = {
      contents: [{
        role: 'user',
        parts: [{ text: `Context (course + syllabus):\n${courseContext}\n\nStudent question:\n${userPrompt}` }]
      }],
      generationConfig: { temperature },
    };

    try {
      // @ts-ignore: generateContentStream is available in recent SDK versions
      const result = await (model as any).generateContentStream(request);
      let full = '';
      // Some SDKs expose an async iterator: result.stream
      if (result && result.stream && Symbol.asyncIterator in result.stream) {
        for await (const item of result.stream as any) {
          const text = (item?.text ? item.text() : item?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('')) || '';
          if (text) {
            full += text;
            onChunk(text);
          }
        }
        return full;
      }
      // Fallback: attempt to read aggregated text
      const agg = result?.response?.text?.() ?? '';
      if (agg) {
        onChunk(agg);
        return agg;
      }
    } catch {
      // ignore and fall back
    }

    const fallback = await this.generateSimpleTaReply(userPrompt, courseContext, temperature);
    onChunk(fallback);
    return fallback;
  }
}
