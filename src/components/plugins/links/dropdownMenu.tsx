import Moment from 'moment/moment';

export const getTaskStatus = (tags: string[]) => {
  let status: string | undefined = undefined;
  if (tags.some((t: string) => new RegExp('(create|start|end|due):.*').test(t))) {
    const startTag = tags.find(t => t.startsWith('start:'));
    const endTag = tags.find(t => t.startsWith('end:'));
    const dueTag = tags.find(t => t.startsWith('due:'));
    if (endTag) {
      const endTime = Moment(endTag.split('end:')[1]);
      if (dueTag && endTime.isAfter(Moment(dueTag.split('due:')[1]))) {
        status = 'Done';
      } else {
        status = 'Done';
      }
    } else if (startTag) {
      const startTime = Moment(startTag.split('start:')[1]);
      if (dueTag && startTime.isAfter(Moment(dueTag.split('due:')[1]))) {
        status = 'Delay';
      } else {
        status = 'Doing';
      }
    } else if (dueTag) {
      const dueTime = Moment(dueTag.split('due:')[1]);
      if (Moment().isAfter(dueTime)) {
        status = 'Delay';
      } else {
        status = 'Todo';
      }
    } else {
      status = 'Todo';
    }
  }
  return status;
};
