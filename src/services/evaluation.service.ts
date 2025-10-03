import { Injectable } from '@angular/core';
import { PlanTask, Condition, ConditionGroup, SubCondition } from '../plan-task.types';
import { TestSection, EvaluationResult, TestComponent, TestLmsAssignment } from '../plan-task-evaluation.types';

@Injectable({ providedIn: 'root' })
export class EvaluationService {

  evaluate(planTask: PlanTask, testSection: TestSection): EvaluationResult | null {
    if (planTask.conditionGroups.length === 0) {
      return null;
    }

    const overallPass = this.checkConditionGroups(planTask.conditionGroups, testSection);
    const resultConfig = overallPass ? planTask.conditionResult : planTask.conditionFailure;
    
    let displayValue = '';
    
    const allConditions = planTask.conditionGroups.flatMap(g => g.conditions);

    if (planTask.displayType === 'Yes/No') {
        displayValue = overallPass ? 'Yes' : 'No';
    } 
    // For other value-based types, we require exactly one condition.
    else if (allConditions.length === 1) {
      const condition = allConditions[0];
      const actualValue = this.getPropertyValue(condition, testSection);
      const expectedValue = condition.value;

      switch (planTask.displayType) {
        case 'Number':
          displayValue = String(actualValue ?? 'N/A');
          break;
        case 'Fraction':
          displayValue = `${actualValue ?? 'N/A'} / ${expectedValue}`;
          break;
        case 'Percent':
           if (typeof actualValue === 'number' && typeof parseFloat(expectedValue) === 'number' && parseFloat(expectedValue) !== 0) {
              const percent = Math.round((actualValue / parseFloat(expectedValue)) * 100);
              displayValue = `${percent}%`;
            } else {
              displayValue = 'N/A';
            }
          break;
        case 'Date':
          displayValue = actualValue ? new Date(actualValue).toLocaleDateString() : 'N/A';
          break;
        case 'Status Label':
           displayValue = String(actualValue ?? 'N/A');
           break;
      }
    }
    
    return {
      passes: overallPass,
      displayValue,
      resultType: resultConfig.type,
      customName: resultConfig.customName,
      icon: resultConfig.icon
    };
  }

  private checkConditionGroups(groups: ConditionGroup[], section: TestSection): boolean {
    if (groups.length === 0) return true; // No conditions means it passes.
    return groups.some(group => this.checkSingleGroup(group.conditions, section));
  }

  private checkSingleGroup(conditions: Condition[], section: TestSection): boolean {
    if (conditions.length === 0) return true;
    return conditions.every(condition => this.checkCondition(condition, section));
  }

  private checkCondition(condition: Condition, section: TestSection): boolean {
    const actualValue = this.getPropertyValue(condition, section);
    let expectedValue = condition.value;

    // Type coercion for numeric comparisons
    if (typeof actualValue === 'number') {
      expectedValue = parseFloat(expectedValue);
    }

    return this.compare(actualValue, condition.operator, expectedValue);
  }
  
  private getPropertyValue(condition: Condition, section: TestSection): any {
    switch (condition.groupType) {
      case 'Syllabus condition':
        switch (condition.source) {
          case 'Syllabus Details':
            switch (condition.property) {
              case 'Publish State': return section.publishState;
              case 'Status': return section.status;
              case 'Material count': return section.materialCount;
              case 'Completed date': return section.completedDate;
            }
            break;
          case 'Component by name':
            const component = section.components.find(c => c.name === condition.property);
            if (condition.operator === 'Is present' || condition.operator === 'Is not present') {
               if (component && condition.subConditions && condition.subConditions.length > 0) {
                  return this.checkSubConditions(condition.subConditions, component);
               }
               return !!component;
            }
            break;
        }
        break;
      case 'LMS Condition':
        switch (condition.source) {
          case 'Assignments':
            switch (condition.property) {
              case 'Total Count':
                if (condition.subConditions && condition.subConditions.length > 0) {
                  const filtered = section.lmsAssignments.filter(a => this.checkSubConditions(condition.subConditions!, a));
                  return filtered.length;
                }
                return section.lmsAssignments.length;
            }
            break;
        }
        break;
      case 'Attribute condition':
        switch (condition.source) {
          case 'Course':
            switch (condition.property) {
              case 'Credit hours': return section.attributeCreditHours;
            }
            break;
          case 'Section':
            switch (condition.property) {
              case 'Term': return section.term;
              case 'Name': return section.name;
            }
            break;
        }
        break;
    }
    return undefined;
  }
  
  private checkSubConditions(subConditions: SubCondition[], item: TestComponent | TestLmsAssignment): boolean {
    return subConditions.every(sub => {
      let actualValue: any;
      
      if ('visible' in item) { // It's a TestComponent
        switch (sub.property) {
          case 'Visible': actualValue = item.visible ? 'Visible' : 'Not Visible'; break;
        }
      } else if ('publishState' in item) { // It's a TestLmsAssignment
        switch (sub.property) {
          case 'Publish State': actualValue = item.publishState; break;
        }
      }

      return this.compare(actualValue, sub.operator, sub.value);
    });
  }

  private compare(actual: any, operator: string, expected: any): boolean {
    if (actual === undefined || actual === null) {
      if (operator === 'Is empty') return true;
      if (operator === 'Is not empty') return false;
      return false; // Can't compare undefined/null with other operators
    }

    if (['Is before', 'Is after', 'Is on'].includes(operator)) {
        if (!actual) return false;

        let resolvedExpected = expected;
        if (expected === '{today}') {
            resolvedExpected = new Date().toISOString();
        }
        
        const actualDate = new Date(actual);
        const expectedDate = new Date(resolvedExpected);

        if (isNaN(actualDate.getTime()) || isNaN(expectedDate.getTime())) return false;

        actualDate.setHours(0, 0, 0, 0);
        expectedDate.setHours(0, 0, 0, 0);

        if (operator === 'Is before') return actualDate < expectedDate;
        if (operator === 'Is after') return actualDate > expectedDate;
        if (operator === 'Is on') return actualDate.getTime() === expectedDate.getTime();
    }

    switch (operator) {
      // Common
      case 'Is':
      case 'Equals':
        return String(actual).toLowerCase() == String(expected).toLowerCase();
      case 'Is not':
      case 'Does not equal':
        return String(actual).toLowerCase() != String(expected).toLowerCase();
      case 'Is empty': return actual === '';
      case 'Is not empty': return actual !== '';
      
      // Presence
      case 'Is present': return !!actual;
      case 'Is not present': return !actual;

      // Numeric
      case 'Is greater than': return actual > expected;
      case 'Is less than': return actual < expected;
      case 'Is greater than or equal to': return actual >= expected;
      case 'Is less than or equal to': return actual <= expected;
      
      // String
      case 'Contains': return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case 'Starts with': return String(actual).toLowerCase().startsWith(String(expected).toLowerCase());
      case 'Ends with': return String(actual).toLowerCase().endsWith(String(expected).toLowerCase());

      default:
        return false;
    }
  }
}
