import React from 'react';
import { CheckCircle, Calendar, FileText, Stethoscope, ShoppingCart } from 'lucide-react';

export function ActionListV2() {
  const actions = [
    {
      id: 1,
      title: 'Schedule physio appointment',
      due: 'Due tomorrow',
      priority: 'high',
      icon: Stethoscope,
      completed: false
    },
    {
      id: 2,
      title: 'Update training plan',
      due: 'Due in 3 days',
      priority: 'medium',
      icon: FileText,
      completed: false
    },
    {
      id: 3,
      title: 'Book race hotel',
      due: 'Due next week',
      priority: 'medium',
      icon: Calendar,
      completed: false
    },
    {
      id: 4,
      title: 'Buy new running shoes',
      due: 'Completed',
      priority: 'low',
      icon: ShoppingCart,
      completed: true
    }
  ];

  return (
    <div className="bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-700/50">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-white">Action List</h3>
        <button className="text-primary text-sm hover:text-primary-light transition-colors">
          + Add task
        </button>
      </div>

      <div className="space-y-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <div
              key={action.id}
              className={`
                flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer
                ${action.completed
                  ? 'bg-dark-base/50 opacity-60'
                  : 'bg-dark-base hover:bg-dark-base/70 border border-slate-700/30'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                ${action.completed ? 'bg-primary/20 text-primary' : ''}
                ${!action.completed && action.priority === 'high' ? 'bg-red-500/20 text-red-400' : ''}
                ${!action.completed && action.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                ${!action.completed && action.priority === 'low' ? 'bg-slate-600/20 text-slate-400' : ''}
              `}>
                {action.completed ? (
                  <CheckCircle size={16} strokeWidth={2.5} />
                ) : (
                  <Icon size={16} strokeWidth={2} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`
                  text-sm font-medium leading-tight
                  ${action.completed ? 'text-slate-500 line-through' : 'text-white'}
                `}>
                  {action.title}
                </p>
                <p className={`
                  text-xs mt-0.5
                  ${action.completed ? 'text-primary' : ''}
                  ${!action.completed && action.priority === 'high' ? 'text-red-400' : ''}
                  ${!action.completed && action.priority === 'medium' ? 'text-yellow-400' : ''}
                  ${!action.completed && action.priority === 'low' ? 'text-slate-500' : ''}
                `}>
                  {action.due}
                </p>
              </div>

              <button className={`
                w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all
                ${action.completed
                  ? 'bg-primary border-primary'
                  : 'border-slate-600 hover:border-slate-500'
                }
              `}>
                {action.completed && (
                  <CheckCircle size={16} className="text-white" strokeWidth={3} />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}